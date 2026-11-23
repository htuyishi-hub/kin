import http from "http";
import app from "./app.js";
import { createWsServer } from "./lib/ws-manager.js";
import { logger } from "./lib/logger.js";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function ensureDatabaseSchema() {
  try {
    await pool.query("ALTER TABLE profiles ALTER COLUMN phone_number DROP NOT NULL;");
    logger.info("Database schema verified: profiles.phone_number is nullable");
  } catch (err: any) {
    logger.warn({ err: err?.message }, "Database schema migration warning");
  }
}

const server = http.createServer(app);
createWsServer(server);

server.listen(port, () => {
  logger.info({ port }, "Server listening");
  ensureDatabaseSchema().catch((err) => {
    logger.warn({ err: err?.message }, "Failed to run ensureDatabaseSchema");
  });
});
