import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://aqxjlxxigwlfgpeityhz.supabase.co';

const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxeGpseHhpZ3dsZmdwZWl0eWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MTEzNjYsImV4cCI6MjA5NzQ4NzM2Nn0.svKanL9cQ2R8cGQ1Zoajf-jdrAWY1owh5J6bdT1BH10';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  try {
    _client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  } catch (err) {
    console.warn('[Supabase Web] Failed to initialize client:', err);
    _client = createClient(supabaseUrl, 'dummy-anon-key', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return _client;
}

export const supabase = getSupabaseClient();
