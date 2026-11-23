import jwt from "jsonwebtoken";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SESSION_SECRET = process.env["SESSION_SECRET"] ?? "kin-dev-secret-please-change";
const SUPABASE_JWT_SECRET =
  process.env["SUPABASE_JWT_SECRET"] ??
  "1FPSMZJruq4dTuQvqwMamp/UwMC9G8k89C/EuxEkzJndV/0nZrKBR3yWd9vOMg4wFW6MYW3p7DPEINAStv0/cg==";

const DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxeGpseHhpZ3dsZmdwZWl0eWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MTEzNjYsImV4cCI6MjA5NzQ4NzM2Nn0.svKanL9cQ2R8cGQ1Zoajf-jdrAWY1owh5J6bdT1BH10";

let authClient: SupabaseClient | null = null;

function getSupabaseAuthClient(): SupabaseClient {
  if (!authClient) {
    const url = process.env["SUPABASE_URL"] || "https://aqxjlxxigwlfgpeityhz.supabase.co";
    const key =
      process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
      process.env["SUPABASE_ANON_KEY"] ||
      DEFAULT_ANON_KEY;
    authClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return authClient;
}

export function signToken(payload: { userId: string }): string {
  return jwt.sign(payload, SESSION_SECRET, { expiresIn: "30d" });
}

export interface VerifiedUser {
  userId: string;
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
}

function extractUserFromDecoded(decoded: any): VerifiedUser | null {
  const userId = decoded?.sub || decoded?.userId;
  if (!userId) return null;
  const email = decoded?.email || null;
  const phone = decoded?.phone || null;
  const fullName =
    decoded?.user_metadata?.full_name ||
    decoded?.user_metadata?.name ||
    null;
  return { userId, email, phone, fullName };
}

export function verifyToken(token: string): VerifiedUser {
  // 1. Verify with Supabase JWT secret (string)
  try {
    const decoded = jwt.verify(token, SUPABASE_JWT_SECRET) as any;
    const user = extractUserFromDecoded(decoded);
    if (user) return user;
  } catch {
    // ignore and try next
  }

  // 1b. Verify with Supabase JWT secret (base64 decoded buffer)
  try {
    const decoded = jwt.verify(token, Buffer.from(SUPABASE_JWT_SECRET, "base64")) as any;
    const user = extractUserFromDecoded(decoded);
    if (user) return user;
  } catch {
    // ignore and try next
  }

  // 2. Verify with local session secret
  try {
    const decoded = jwt.verify(token, SESSION_SECRET) as any;
    const user = extractUserFromDecoded(decoded);
    if (user) return user;
  } catch {
    // ignore and fail
  }

  throw new Error("Invalid or unverified token");
}

export async function verifyTokenAsync(token: string): Promise<VerifiedUser> {
  // 1. Try fast local signature checks
  try {
    return verifyToken(token);
  } catch {
    // ignore and proceed to online verification fallback
  }

  // 2. Online verification with Supabase Auth service
  try {
    const client = getSupabaseAuthClient();
    const { data, error } = await client.auth.getUser(token);
    if (!error && data?.user?.id) {
      const u = data.user;
      return {
        userId: u.id,
        email: u.email || null,
        phone: u.phone || null,
        fullName:
          u.user_metadata?.full_name ||
          u.user_metadata?.name ||
          null,
      };
    }
  } catch {
    // ignore
  }

  throw new Error("Invalid or unverified token");
}

