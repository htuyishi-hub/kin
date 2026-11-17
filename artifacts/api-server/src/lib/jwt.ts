import jwt from "jsonwebtoken";

const SESSION_SECRET = process.env["SESSION_SECRET"] ?? "kin-dev-secret-please-change";
const SUPABASE_JWT_SECRET =
  process.env["SUPABASE_JWT_SECRET"] ??
  "1FPSMZJruq4dTuQvqwMamp/UwMC9G8k89C/EuxEkzJndV/0nZrKBR3yWd9vOMg4wFW6MYW3p7DPEINAStv0/cg==";

export function signToken(payload: { userId: string }): string {
  return jwt.sign(payload, SESSION_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): { userId: string } {
  // 1. Verify with Supabase JWT secret
  try {
    const decoded = jwt.verify(token, SUPABASE_JWT_SECRET) as any;
    const userId = decoded.sub || decoded.userId;
    if (userId) return { userId };
  } catch {
    // ignore and try next
  }

  // 2. Verify with local session secret
  try {
    const decoded = jwt.verify(token, SESSION_SECRET) as any;
    const userId = decoded.userId || decoded.sub;
    if (userId) return { userId };
  } catch {
    // ignore and fail
  }

  throw new Error("Invalid or unverified token");
}
