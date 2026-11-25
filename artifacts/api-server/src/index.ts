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
    await pool.query("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bonus_swipes_today INTEGER DEFAULT 0;");
    await pool.query("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bonus_swipes_date TEXT;");
    logger.info("Database schema verified: profiles columns up to date");
  } catch (err: any) {
    logger.warn({ err: err?.message }, "Database schema migration warning");
  }
}

function startKeepAlive() {
  const baseUrl = (process.env["RENDER_EXTERNAL_URL"] || process.env["KEEP_ALIVE_URL"] || "").replace(/\/+$/, "");
  if (!baseUrl) return;

  const target = `${baseUrl}/api/healthz`;
  const intervalMs = 14 * 60 * 1000;

  const timer = setInterval(async () => {
    try {
      const res = await fetch(target, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        logger.warn({ status: res.status, target }, "Keep-alive ping returned non-2xx");
      }
    } catch (err: any) {
      logger.warn({ err: err?.message, target }, "Keep-alive ping failed");
    }
  }, intervalMs);

  timer.unref();
  logger.info({ target, intervalMs }, "Render keep-alive enabled");
}

const server = http.createServer(app);
createWsServer(server);

server.listen(port, () => {
  logger.info({ port }, "Server listening");
  startKeepAlive();
  ensureDatabaseSchema().catch((err) => {
    logger.warn({ err: err?.message }, "Failed to run ensureDatabaseSchema");
  });
});
