import { randomBytes } from "crypto";

export function generateInviteCode(): string {
  // 6 alphanumeric chars avoiding visually ambiguous characters (0, O, 1, I)
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(6);
  let code = "KIN-";
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i]! % chars.length];
  }
  return code;
}
