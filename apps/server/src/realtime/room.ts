import type { FastifyBaseLogger } from "fastify";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import type { WebSocket } from "ws";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";

/**
 * Message types of the standard y-websocket protocol (the first number in every
 * binary message). The browser uses the y-websocket client, which speaks the same protocol.
 */
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

/**
 * One board being edited live. Holds the server's copy of the Y.Doc and relays changes
 * between everyone connected to it.
 *
 * - Sync: document changes (elements, arrows). The server merges them into its own
 *   Y.Doc, so a newly connected user gets the full board from it.
 * - Awareness: short-lived per-user state (cursor, name) that is never stored. Used for
 *   live cursors later.
 */
export class Room {
  readonly doc = new Y.Doc();
  readonly awareness = new awarenessProtocol.Awareness(this.doc);
  /** Every connection, with the awareness client ids it owns (cleaned up on disconnect). */
  private readonly connections = new Map<WebSocket, Set<number>>();

  constructor(
    readonly id: string,
    private readonly log: FastifyBaseLogger,
  ) {
    this.awareness.setLocalState(null); // the server itself is not a "user"

    // Any change to the document (from a client or the server) goes to everyone else.
    // `origin` is the connection the change came from: it already has it.
    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      this.broadcast(encoding.toUint8Array(encoder), origin);
    });

    this.awareness.on("update", (changes: AwarenessChanges, origin: unknown) => {
      // Remember which awareness ids belong to which connection, to remove them on close
      const owned = this.connections.get(origin as WebSocket);
      if (owned) {
        for (const clientId of changes.added) owned.add(clientId);
        for (const clientId of changes.removed) owned.delete(clientId);
      }

      const changed = [...changes.added, ...changes.updated, ...changes.removed];
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed),
      );
      this.broadcast(encoding.toUint8Array(encoder));
    });
  }

  get connectionCount(): number {
    return this.connections.size;
  }

  addConnection(socket: WebSocket): void {
    socket.binaryType = "arraybuffer";
    this.connections.set(socket, new Set());

    socket.on("message", (data: ArrayBuffer) => this.handleMessage(socket, new Uint8Array(data)));
    socket.on("close", () => this.removeConnection(socket));

    // Sync step 1: "this is what I have". The client answers with what the server is
    // missing (step 2), and sends its own step 1 to get what IT is missing.
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    this.send(socket, encoding.toUint8Array(encoder));

    // Tell the newcomer who else is here
    const clientIds = [...this.awareness.getStates().keys()];
    if (clientIds.length > 0) {
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, clientIds),
      );
      this.send(socket, encoding.toUint8Array(awarenessEncoder));
    }
  }

  private handleMessage(socket: WebSocket, message: Uint8Array): void {
    try {
      const decoder = decoding.createDecoder(message);
      const messageType = decoding.readVarUint(decoder);

      if (messageType === MESSAGE_SYNC) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        // Applies the client's changes to our doc (origin = socket) and, for a step 1
        // request, writes the answer into `encoder`
        syncProtocol.readSyncMessage(decoder, encoder, this.doc, socket);
        if (encoding.length(encoder) > 1) this.send(socket, encoding.toUint8Array(encoder));
      } else if (messageType === MESSAGE_AWARENESS) {
        awarenessProtocol.applyAwarenessUpdate(
          this.awareness,
          decoding.readVarUint8Array(decoder),
          socket,
        );
      }
      // Other message types (auth, awareness queries) aren't used by this app
    } catch (error) {
      this.log.warn({ err: error, room: this.id }, "Invalid realtime message, closing connection");
      socket.close(1003, "Invalid message");
    }
  }

  private removeConnection(socket: WebSocket): void {
    const owned = this.connections.get(socket);
    if (!owned) return;
    this.connections.delete(socket);
    // The user is gone: drop their cursor etc. for everyone else
    awarenessProtocol.removeAwarenessStates(this.awareness, [...owned], null);
  }

  private broadcast(message: Uint8Array, except?: unknown): void {
    for (const socket of this.connections.keys()) {
      if (socket !== except) this.send(socket, message);
    }
  }

  private send(socket: WebSocket, message: Uint8Array): void {
    if (socket.readyState !== socket.OPEN) {
      this.removeConnection(socket);
      return;
    }
    socket.send(message, (error) => {
      if (error) this.removeConnection(socket);
    });
  }
}

interface AwarenessChanges {
  added: number[];
  updated: number[];
  removed: number[];
}
