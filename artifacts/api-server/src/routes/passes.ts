import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, passesTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";

const router = Router();

// POST /passes — Handles Soft Pass (14-day temporary hide) and Hard Reject (permanent)
router.post("/passes", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { targetUserId, action } = req.body as {
    targetUserId?: string;
    action?: "soft_pass" | "hard_reject";
  };

  if (!targetUserId) {
    res.status(400).json({ error: "bad_request", message: "targetUserId is required" });
    return;
  }

  if (targetUserId === userId) {
    res.status(400).json({ error: "bad_request", message: "Cannot pass on yourself" });
    return;
  }

  const passType = action === "hard_reject" ? "hard_reject" : "soft_pass";
  // Soft pass hides candidate for 14 days; hard reject is indefinite
  const expiresAt = passType === "soft_pass" ? new Date(Date.now() + 14 * 24 * 3600 * 1000) : null;

  const existing = await db
    .select()
    .from(passesTable)
    .where(and(eq(passesTable.userId, userId), eq(passesTable.targetUserId, targetUserId)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(passesTable)
      .set({
        type: passType,
        expiresAt,
        createdAt: new Date(),
      })
      .where(eq(passesTable.id, existing[0].id));
  } else {
    await db.insert(passesTable).values({
      userId,
      targetUserId,
      type: passType,
      expiresAt,
    });
  }

  res.json({
    success: true,
    action: passType,
    targetUserId,
    hiddenUntil: expiresAt ? expiresAt.toISOString() : "permanent",
  });
});

export default router;
