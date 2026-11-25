import http from "http";
import app from "./app.js";
import { createWsServer } from "./lib/ws-manager.js";
import { logger } from "./lib/logger.js";
import { pool } from "@workspace/db";
import { getStorageAdmin } from "./lib/storage.js";

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
    await pool.query("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unblurred_likes_until TIMESTAMPTZ DEFAULT NULL;");
    await pool.query("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'none';");
    await pool.query("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_incognito BOOLEAN NOT NULL DEFAULT FALSE;");
    await pool.query("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS popularity_score INTEGER NOT NULL DEFAULT 0;");
    await pool.query("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weekly_rank INTEGER DEFAULT NULL;");
    await pool.query("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS campus_zone TEXT DEFAULT 'Kigali';");
    await pool.query("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS spotlight_until TIMESTAMPTZ DEFAULT NULL;");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS popularity_votes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        voter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        target_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        points INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_votes_target ON popularity_votes(target_id);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_votes_voter_today ON popularity_votes(voter_id, created_at);");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rush_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_a UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        user_b UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'active',
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '3 minutes'),
        user_a_decision TEXT DEFAULT 'pending',
        user_b_decision TEXT DEFAULT 'pending',
        match_id UUID REFERENCES matches(id) ON DELETE SET NULL
      );
    `);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_rush_user_a ON rush_sessions(user_a);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_rush_user_b ON rush_sessions(user_b);");
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rush_sessions'
        ) THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.rush_sessions;
        END IF;
      EXCEPTION WHEN undefined_object THEN
        NULL;
      END $$;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS name_searches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        searcher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        searched_query TEXT NOT NULL,
        target_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
        is_unmasked BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_name_searches_target ON name_searches(target_profile_id);");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS photo_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        target_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        photo_url TEXT NOT NULL,
        comment_text TEXT NOT NULL,
        amount_rwf INTEGER NOT NULL DEFAULT 200,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_photo_comments_target ON photo_comments(target_profile_id);");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blocked_contacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        blocked_phone TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_blocked_contacts_user ON blocked_contacts(user_id);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_blocked_contacts_phone ON blocked_contacts(blocked_phone);");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS date_invites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        spot_name TEXT NOT NULL,
        spot_area TEXT NOT NULL,
        proposed_time TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
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
    await pool.query("CREATE INDEX IF NOT EXISTS chat_gifts_match_id_idx ON chat_gifts(match_id);");
    await pool.query("ALTER TABLE chat_gifts ENABLE ROW LEVEL SECURITY;");
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public' AND tablename = 'chat_gifts' AND policyname = 'chat_gifts_participants_read'
        ) THEN
          CREATE POLICY chat_gifts_participants_read ON public.chat_gifts
            FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
        END IF;
      END $$;
    `);
    await pool.query(`
      DO $$
      BEGIN
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_gifts;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END $$;
    `);
    const admin = getStorageAdmin();
    if (admin) {
      await admin.storage.createBucket("chat-media", { public: false }).catch(() => {});
    }
    logger.info("Database schema verified: profiles, matches, messages, chat_gifts, realtime, chat-media up to date");
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
