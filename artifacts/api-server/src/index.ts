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
    await pool.query("ALTER TABLE matches ADD COLUMN IF NOT EXISTS streak_count INTEGER NOT NULL DEFAULT 0;");
    await pool.query("ALTER TABLE matches ADD COLUMN IF NOT EXISTS last_streak_date TEXT;");
    await pool.query("ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_revived BOOLEAN NOT NULL DEFAULT FALSE;");
    await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'text';");
    await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url TEXT;");
    await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions JSONB NOT NULL DEFAULT '{}'::jsonb;");
    await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS game_data JSONB;");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_gifts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        gift_type TEXT NOT NULL,
        amount_rwf INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    logger.info("Database schema verified: profiles, matches, messages, chat_gifts up to date");
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
