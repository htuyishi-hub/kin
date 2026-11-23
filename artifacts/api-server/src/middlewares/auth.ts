import { Request, Response, NextFunction } from "express";
import { verifyTokenAsync } from "../lib/jwt.js";

export interface AuthedRequest extends Request {
  userId: string;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;

  // Temp debug logs to diagnose missing/invalid auth in browser builds.
  // Safe: does not log the full JWT.
  try {
    (req as any).log?.info?.(
      {
        hasAuthHeader: Boolean(auth),
        authScheme: typeof auth === "string" ? auth.slice(0, 7) : null,
      },
      "requireAuth: auth header check",
    );
  } catch {
    // ignore logging failures
  }

  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized", message: "Missing bearer token" });
    return;
  }

  try {
    const token = auth.slice(7);
    const { userId } = await verifyTokenAsync(token);
    (req as AuthedRequest).userId = userId;

    try {
      (req as any).log?.info?.({ userId }, "requireAuth: verified token");
    } catch {
      // ignore logging failures
    }

    next();
  } catch (err) {

    try {
      (req as any).log?.warn?.(
        { reason: err instanceof Error ? err.message : String(err) },
        "requireAuth: token verification failed",
      );
    } catch {
      // ignore logging failures
    }

    res.status(401).json({ error: "unauthorized", message: "Invalid or expired token" });
  }
}

