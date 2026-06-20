import { Router } from "express";
import { eq, and, or } from "drizzle-orm";
import { db, interestsTable, matchesTable, profilesTable, trustEventsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";

const router = Router();

async function applyTrustEvent(userId: string, eventType: string, delta: number, sourceId?: string) {
  await db.insert(trustEventsTable).values({ userId, eventType, delta: delta as any, sourceId });
  await db
    .update(profilesTable)
    .set({ trustScore: Math.max(0, Math.min(100, delta)) as any })
    .where(eq(profilesTable.id, userId));
}

// POST /interests
router.post("/interests", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { toUserId } = req.body as { toUserId?: string };

  if (!toUserId) {
    res.status(400).json({ error: "bad_request", message: "toUserId is required" });
    return;
  }

  if (toUserId === userId) {
    res.status(400).json({ error: "bad_request", message: "Cannot express interest in yourself" });
    return;
  }

  // Check duplicate
  const existing = await db
    .select()
    .from(interestsTable)
    .where(and(eq(interestsTable.fromUser, userId), eq(interestsTable.toUser, toUserId)))
    .limit(1);

  if (existing.length > 0) {
    res.status(400).json({ error: "duplicate", message: "Already expressed interest" });
    return;
  }

  await db.insert(interestsTable).values({ fromUser: userId, toUser: toUserId });

  // Check for mutual interest
  const mutual = await db
    .select()
    .from(interestsTable)
    .where(and(eq(interestsTable.fromUser, toUserId), eq(interestsTable.toUser, userId)))
    .limit(1);

  if (mutual.length === 0) {
    res.json({ recorded: true, matchCreated: false, matchId: null });
    return;
  }

  // Create match
  const existingMatch = await db
    .select()
    .from(matchesTable)
    .where(
      or(
        and(eq(matchesTable.userA, userId), eq(matchesTable.userB, toUserId)),
        and(eq(matchesTable.userA, toUserId), eq(matchesTable.userB, userId)),
      )
    )
    .limit(1);

  if (existingMatch.length > 0) {
    res.json({ recorded: true, matchCreated: false, matchId: existingMatch[0]!.id });
    return;
  }

  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
  const assignedFirstUser = Math.random() > 0.5 ? userId : toUserId;

  const [match] = await db
    .insert(matchesTable)
    .values({
      userA: userId,
      userB: toUserId,
      assignedFirstUser,
      expiresAt,
    })
    .returning();

  res.json({ recorded: true, matchCreated: true, matchId: match!.id });
});

export default router;
