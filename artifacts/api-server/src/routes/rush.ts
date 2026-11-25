import { Router } from "express";
import { and, desc, eq, ne, or } from "drizzle-orm";
import {
  db,
  profilesTable,
  matchesTable,
  messagesTable,
  rushSessionsTable,
} from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";

const router = Router();

// In-memory waiting queue and blind chat messages for 8 PM Rush
const waitingQueue = new Set<string>();
const rushMessages = new Map<
  string,
  Array<{ id: string; senderId: string; text: string; createdAt: string }>
>();

function calculateAge(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

async function getPartnerSummary(partnerId: string) {
  const [p] = await db
    .select({
      id: profilesTable.id,
      dateOfBirth: profilesTable.dateOfBirth,
      campusName: profilesTable.campusName,
      city: profilesTable.city,
      primaryIntent: profilesTable.primaryIntent,
    })
    .from(profilesTable)
    .where(eq(profilesTable.id, partnerId))
    .limit(1);

  return {
    id: partnerId,
    age: calculateAge(p?.dateOfBirth ?? null),
    campus: p?.campusName ?? p?.city ?? "Kigali",
    primaryIntent: p?.primaryIntent ?? "Serious",
    passions: [] as string[],
  };
}

// GET /rush/status — Live status of 8 PM Rush
router.get("/rush/status", requireAuth, async (_req, res) => {
  res.json({
    isActive: true,
    nextEventTime: "20:00",
    onlineCount: Math.max(12, waitingQueue.size + 14),
  });
});

// POST /rush/join — Enter blind speed date queue or pair immediately
router.post("/rush/join", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;

  // Check if user already has an active rush session
  const [existing] = await db
    .select()
    .from(rushSessionsTable)
    .where(
      and(
        eq(rushSessionsTable.status, "active"),
        or(eq(rushSessionsTable.userA, userId), eq(rushSessionsTable.userB, userId))
      )
    )
    .orderBy(desc(rushSessionsTable.startedAt))
    .limit(1);

  if (existing && existing.endsAt > new Date()) {
    const partnerId = existing.userA === userId ? existing.userB : existing.userA;
    const partner = await getPartnerSummary(partnerId);
    res.json({
      sessionId: existing.id,
      partner,
      endsAt: existing.endsAt.toISOString(),
    });
    return;
  }

  // Pair with another waiting user, or fallback to an active community member for instant live match
  let partnerId: string | null = null;
  for (const candidateId of waitingQueue) {
    if (candidateId !== userId) {
      partnerId = candidateId;
      waitingQueue.delete(candidateId);
      break;
    }
  }

  if (!partnerId) {
    waitingQueue.add(userId);
    const [fallback] = await db
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(
        and(
          ne(profilesTable.id, userId),
          eq(profilesTable.profileActive, true),
          eq(profilesTable.onboardingComplete, true)
        )
      )
      .limit(1);

    if (fallback) {
      partnerId = fallback.id;
      waitingQueue.delete(userId);
    }
  }

  if (!partnerId) {
    res.json({ waiting: true, sessionId: null });
    return;
  }

  const endsAt = new Date(Date.now() + 3 * 60 * 1000);
  const [created] = await db
    .insert(rushSessionsTable)
    .values({
      userA: userId,
      userB: partnerId,
      status: "active",
      endsAt,
      userADecision: "pending",
      userBDecision: "pending",
    })
    .returning();

  const partner = await getPartnerSummary(partnerId);
  res.json({
    sessionId: created!.id,
    partner,
    endsAt: created!.endsAt.toISOString(),
  });
});

// GET /rush/session/:sessionId — Poll current session & blind messages
router.get("/rush/session/:sessionId", requireAuth, async (req, res) => {
  const sessionId = String(req.params["sessionId"] ?? "");
  const [session] = await db
    .select()
    .from(rushSessionsTable)
    .where(eq(rushSessionsTable.id, sessionId))
    .limit(1);

  if (!session) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  res.json({
    sessionId: session.id,
    status: session.status,
    endsAt: session.endsAt.toISOString(),
    userADecision: session.userADecision,
    userBDecision: session.userBDecision,
    matchId: session.matchId,
    messages: rushMessages.get(sessionId) ?? [],
  });
});

// POST /rush/message — Send blind speed date message
router.post("/rush/message", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { sessionId, text } = req.body as { sessionId?: string; text?: string };
  if (!sessionId || !text?.trim()) {
    res.status(400).json({ error: "invalid_message" });
    return;
  }

  const list = rushMessages.get(sessionId) ?? [];
  const msg = {
    id: crypto.randomUUID(),
    senderId: userId,
    text: text.trim().slice(0, 300),
    createdAt: new Date().toISOString(),
  };
  list.push(msg);
  rushMessages.set(sessionId, list);
  res.json(msg);
});

// POST /rush/decision — Submit Reveal & Match or Pass
router.post("/rush/decision", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { sessionId, decision } = req.body as {
    sessionId?: string;
    decision?: "reveal" | "pass";
  };

  if (!sessionId || (decision !== "reveal" && decision !== "pass")) {
    res.status(400).json({ error: "invalid_decision" });
    return;
  }

  const [session] = await db
    .select()
    .from(rushSessionsTable)
    .where(eq(rushSessionsTable.id, sessionId))
    .limit(1);

  if (!session) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  const isUserA = session.userA === userId;
  const nextA = isUserA ? decision : session.userADecision;
  const nextB = !isUserA ? decision : session.userBDecision;

  let nextStatus = session.status;
  let matchId = session.matchId;

  if (decision === "pass") {
    nextStatus = "passed";
  } else if (nextA === "reveal" && (nextB === "reveal" || nextB === "pending")) {
    // If partner is a live user who also reveals (or completes), create match when both reveal
    if (nextA === "reveal" && nextB === "reveal") {
      nextStatus = "matched";
      if (!matchId) {
        const [a, b] = session.userA < session.userB ? [session.userA, session.userB] : [session.userB, session.userA];
        const [existingMatch] = await db
          .select({ id: matchesTable.id })
          .from(matchesTable)
          .where(and(eq(matchesTable.userA, a), eq(matchesTable.userB, b)))
          .limit(1);

        if (existingMatch) {
          matchId = existingMatch.id;
        } else {
          const [createdMatch] = await db
            .insert(matchesTable)
            .values({
              userA: a,
              userB: b,
              expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
            })
            .returning({ id: matchesTable.id });
          matchId = createdMatch?.id ?? null;

          if (matchId) {
            await db.insert(messagesTable).values({
              matchId,
              senderId: userId,
              content: "Matched via 8 PM Blind Date 🔥",
            });
          }
        }
      }
    }
  }

  await db
    .update(rushSessionsTable)
    .set({
      userADecision: nextA,
      userBDecision: nextB,
      status: nextStatus,
      matchId,
    })
    .where(eq(rushSessionsTable.id, sessionId));

  res.json({
    status: nextStatus,
    matchId,
    userADecision: nextA,
    userBDecision: nextB,
  });
});

export default router;
