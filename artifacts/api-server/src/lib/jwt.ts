import jwt from "jsonwebtoken";

const SECRET = process.env["SESSION_SECRET"] ?? "kin-dev-secret-please-change";

export function signToken(payload: { userId: string }): string {
  return jwt.sign(payload, SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): { userId: string } {
  return jwt.verify(token, SECRET) as { userId: string };
}
