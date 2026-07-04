import type { Request, Response } from "express";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";

// Phase 1B stub endpoint for UR registration verification.
// No validation is performed yet.
export function verifyURRegistration(req: Request, res: Response) {
  // If auth is required in the future, we can move this to requireAuth wrapper.
  // For now, keep consistent with other routes that use requireAuth.
  return res.status(200).json({
    status: "not_implemented",
    message: "UR verification stub - Phase 2 implementation pending",
  });
}

// Convenience export to match router registration style (with auth requirement).
export default function urVerificationRouter() {
  return {
    requireAuth,
    verifyURRegistration,
  } as const;
}

