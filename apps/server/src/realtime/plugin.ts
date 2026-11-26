import websocket from "@fastify/websocket";
import { BOARD_ID_PATTERN } from "@collab-board/shared";
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { z } from "zod";
import { config } from "../config.js";
import { RoomManager } from "./room-manager.js";
import type { BoardStorage } from "./storage/board-storage.js";

const paramsSchema = z.object({ boardId: z.string().regex(BOARD_ID_PATTERN) });

/** Large enough for a big board's initial sync, small enough to stop abuse. */
const MAX_MESSAGE_BYTES = 2 * 1024 * 1024;
const PING_INTERVAL_MS = 30_000;

export interface RealtimeOptions {
  storage: BoardStorage;
}

/**
 * Real-time collaboration: one WebSocket endpoint per board, `/ws/<boardId>`.
 * Rooms are loaded from storage on first use and saved while people edit.
 */
export async function realtimePlugin(app: FastifyInstance, { storage }: RealtimeOptions) {
  await app.register(websocket, { options: { maxPayload: MAX_MESSAGE_BYTES } });

  const rooms = new RoomManager(storage, app.log);
  // Save every open board before the server stops (deploy, restart)
  app.addHook("onClose", () => rooms.closeAll());

  app.get(
    "/ws/:boardId",
    {
      websocket: true,
      // Runs BEFORE the HTTP connection is upgraded, so a bad request gets a normal
      // HTTP error. This is also where the board password will be checked.
      preValidation: async (request, reply) => {
        // Browsers don't apply CORS to WebSockets: check the Origin ourselves, so other
        // websites can't open a connection with the visitor's cookies
        if (request.headers.origin !== config.corsOrigin) {
          return reply.code(403).send({ error: "Origin not allowed" });
        }
        if (!paramsSchema.safeParse(request.params).success) {
          return reply.code(400).send({ error: "Invalid board id" });
        }
      },
    },
    async (socket, request) => {
      const { boardId } = paramsSchema.parse(request.params);

      // The client starts syncing as soon as it connects, maybe before the room has
      // loaded from the database: keep those first messages and replay them
      const earlyMessages: ArrayBuffer[] = [];
      const bufferMessage = (data: ArrayBuffer) => earlyMessages.push(data);
      socket.binaryType = "arraybuffer";
      socket.on("message", bufferMessage);
      keepAlive(socket);

      let room;
      try {
        room = await rooms.getRoom(boardId);
      } catch (error) {
        app.log.error({ err: error, boardId }, "Could not load board");
        socket.close(1011, "Could not load board"); // the client will retry
        return;
      } finally {
        socket.off("message", bufferMessage);
      }
      if (socket.readyState !== socket.OPEN) return; // left while the board was loading

      room.addConnection(socket, earlyMessages);

      app.log.info({ boardId, connections: room.connectionCount }, "Client joined board");
      socket.on("close", () => {
        app.log.info({ boardId, connections: room.connectionCount }, "Client left board");
      });
    },
  );
}

/**
 * Pings the client regularly and drops it if it stops answering (e.g. laptop lid closed),
 * so dead connections don't pile up and their cursors disappear for others.
 */
function keepAlive(socket: WebSocket) {
  let isAlive = true;
  socket.on("pong", () => (isAlive = true));

  const timer = setInterval(() => {
    if (!isAlive) {
      socket.terminate();
      return;
    }
    isAlive = false;
    socket.ping();
  }, PING_INTERVAL_MS);

  socket.on("close", () => clearInterval(timer));
}
