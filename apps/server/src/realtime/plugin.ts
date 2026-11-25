import websocket from "@fastify/websocket";
import { BOARD_ID_PATTERN, DEMO_BOARD, DEMO_BOARD_ID, loadBoard } from "@collab-board/shared";
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { z } from "zod";
import { config } from "../config.js";
import { Room } from "./room.js";

const paramsSchema = z.object({ boardId: z.string().regex(BOARD_ID_PATTERN) });

/** Large enough for a big board's initial sync, small enough to stop abuse. */
const MAX_MESSAGE_BYTES = 2 * 1024 * 1024;
const PING_INTERVAL_MS = 30_000;

/**
 * Real-time collaboration: one WebSocket endpoint per board, `/ws/<boardId>`.
 * Rooms live in memory for now; persistence in PostgreSQL comes in a later step.
 */
export async function realtimePlugin(app: FastifyInstance) {
  await app.register(websocket, { options: { maxPayload: MAX_MESSAGE_BYTES } });

  const rooms = new Map<string, Room>();

  function getRoom(boardId: string): Room {
    let room = rooms.get(boardId);
    if (!room) {
      room = new Room(boardId, app.log);
      if (boardId === DEMO_BOARD_ID) loadBoard(room.doc, DEMO_BOARD);
      rooms.set(boardId, room);
    }
    return room;
  }

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
    (socket, request) => {
      const { boardId } = paramsSchema.parse(request.params);
      const room = getRoom(boardId);
      room.addConnection(socket);
      keepAlive(socket);

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
