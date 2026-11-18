import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHUNK_SIZE = 1800; // Android Keystore SharedPreferences max is 2048 bytes

export const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(key);
    }

    try {
      const header = await SecureStore.getItemAsync(key);
      if (!header) return null;

      // Check if stored in chunks
      if (header.startsWith('__chunked__:')) {
        const count = parseInt(header.split(':')[1], 10);
        const parts: string[] = [];
        for (let i = 0; i < count; i++) {
          const chunk = await SecureStore.getItemAsync(`${key}__${i}`);
          if (chunk !== null) {
            parts.push(chunk);
          }
        }
        return parts.join('');
      }

      return header;
    } catch (err) {
      console.warn('[SecureStoreAdapter] getItem error:', err);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
      return;
    }

    try {
      if (value.length <= CHUNK_SIZE) {
        // Clear any previous chunks if transitioning from large to small
        await ExpoSecureStoreAdapter.removeItem(key);
        await SecureStore.setItemAsync(key, value);
      } else {
        const chunks: string[] = [];
        for (let i = 0; i < value.length; i += CHUNK_SIZE) {
          chunks.push(value.slice(i, i + CHUNK_SIZE));
        }

        // Store chunk count header
        await SecureStore.setItemAsync(key, `__chunked__:${chunks.length}`);

        // Store each chunk
        for (let i = 0; i < chunks.length; i++) {
          await SecureStore.setItemAsync(`${key}__${i}`, chunks[i]);
        }
      }
    } catch (err) {
      console.warn('[SecureStoreAdapter] setItem error:', err);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
      return;
    }

    try {
      const header = await SecureStore.getItemAsync(key);
      if (header && header.startsWith('__chunked__:')) {
        const count = parseInt(header.split(':')[1], 10);
        for (let i = 0; i < count; i++) {
          await SecureStore.deleteItemAsync(`${key}__${i}`).catch(() => {});
        }
      }
      await SecureStore.deleteItemAsync(key).catch(() => {});
    } catch (err) {
      console.warn('[SecureStoreAdapter] removeItem error:', err);
    }
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://aqxjlxxigwlfgpeityhz.supabase.co';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxeGpseHhpZ3dsZmdwZWl0eWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MTEzNjYsImV4cCI6MjA5NzQ4NzM2Nn0.svKanL9cQ2R8cGQ1Zoajf-jdrAWY1owh5J6bdT1BH10';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  try {
    _client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  } catch (err) {
    console.warn('[Supabase] Failed to initialize client:', err);
    // Fallback unauthenticated stub so module import does not crash
    _client = createClient(supabaseUrl, 'dummy-anon-key', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return _client;
}

export const supabase = getSupabaseClient();
