import type { IncomingMessage, Server } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { verifyToken } from "./jwt.js";

const rooms = new Map<string, Set<WebSocket>>();

export function createWsServer(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    let subscribedMatchId: string | null = null;
    let authedUserId: string | null = null;

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;

        if (msg["type"] === "auth" && typeof msg["token"] === "string") {
          try {
            const payload = verifyToken(msg["token"]);
            authedUserId = payload.userId;
            ws.send(JSON.stringify({ type: "authed", userId: authedUserId }));
          } catch {
            ws.send(JSON.stringify({ type: "error", message: "Invalid token" }));
          }
          return;
        }

        if (msg["type"] === "subscribe" && typeof msg["matchId"] === "string") {
          if (!authedUserId) {
            ws.send(JSON.stringify({ type: "error", message: "Not authenticated" }));
            return;
          }
          if (subscribedMatchId) {
            rooms.get(subscribedMatchId)?.delete(ws);
          }
          subscribedMatchId = msg["matchId"];
          if (!rooms.has(subscribedMatchId)) rooms.set(subscribedMatchId, new Set());
          rooms.get(subscribedMatchId)!.add(ws);
          ws.send(JSON.stringify({ type: "subscribed", matchId: subscribedMatchId }));
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("close", () => {
      if (subscribedMatchId) {
        rooms.get(subscribedMatchId)?.delete(ws);
        if (rooms.get(subscribedMatchId)?.size === 0) rooms.delete(subscribedMatchId);
      }
    });

    ws.on("error", () => {
      if (subscribedMatchId) rooms.get(subscribedMatchId)?.delete(ws);
    });
  });

  return wss;
}

export function broadcastToMatch(matchId: string, payload: object) {
  const clients = rooms.get(matchId);
  if (!clients || clients.size === 0) return;
  const data = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}
