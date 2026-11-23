import { Router } from "express";
import { eq, and, or, desc } from "drizzle-orm";
import { db, messagesTable, matchesTable, profilesTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";
import { broadcastToMatch } from "../lib/ws-manager.js";
import { sendPushNotification } from "../lib/notifications.js";

const router = Router();

const PHASE1_PROMPTS = [
  "What does a good home mean to you?",
  "What did you learn about relationships from your family?",
  "What values matter most to you in a partner?",
];

const PHASE2_PROMPTS = [
  "Where do you want to be in five years?",
  "What role does faith or community play in how you make decisions?",
  "What is one thing you want to build in your life?",
];

function mapMessage(m: typeof messagesTable.$inferSelect) {
  return {
    id: m.id,
    matchId: m.matchId,
    senderId: m.senderId,
    content: m.content,
    phase: m.phase ?? 1,
    promptKey: m.promptKey ?? null,
    promptText: null as string | null,
    isSystem: m.isSystem ?? false,
    readAt: m.readAt?.toISOString() ?? null,
    createdAt: m.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

// GET /matches/:matchId/messages
router.get("/matches/:matchId/messages", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { matchId } = req.params;
  const limit = Math.min(Number(req.query["limit"] ?? 50), 100);

  const [match] = await db
    .select()
    .from(matchesTable)
    .where(
      and(
        eq(matchesTable.id, String(matchId)),
        or(eq(matchesTable.userA, userId), eq(matchesTable.userB, userId)),
      )
    )
    .limit(1);

  if (!match) {
    res.status(404).json({ error: "not_found", message: "Match not found" });
    return;
  }

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.matchId, String(matchId)))
    .orderBy(desc(messagesTable.createdAt))
    .limit(limit);

  res.json(messages.reverse().map(mapMessage));
});

// POST /matches/:matchId/messages
router.post("/matches/:matchId/messages", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { matchId } = req.params;
  const { content, promptKey } = req.body as { content?: string; promptKey?: string };

  if (!content || content.trim().length === 0) {
    res.status(400).json({ error: "bad_request", message: "content is required" });
    return;
  }

  if (content.length > 1000) {
    res.status(400).json({ error: "bad_request", message: "Message too long (max 1000 chars)" });
    return;
  }

  const [match] = await db
    .select()
    .from(matchesTable)
    .where(
      and(
        eq(matchesTable.id, String(matchId)),
        or(eq(matchesTable.userA, userId), eq(matchesTable.userB, userId)),
        eq(matchesTable.status, "active"),
      )
    )
    .limit(1);

  if (!match) {
    res.status(404).json({ error: "not_found", message: "Match not found or not active" });
    return;
  }

  if (!match.firstMessageSent && match.assignedFirstUser !== userId) {
    res.status(403).json({
      error: "forbidden",
      message: "The system has assigned the other person to send the first message today.",
    });
    return;
  }

  const phase = match.conversationPhase ?? 1;
  const isFirstMessage = !match.firstMessageSent;

  const [message] = await db
    .insert(messagesTable)
    .values({
      matchId: String(matchId),
      senderId: userId,
      content: content.trim(),
      phase: phase as any,
      promptKey: promptKey ?? null,
      isSystem: false,
    })
    .returning();

  const updates: Partial<typeof matchesTable.$inferInsert> = {
    lastMessageAt: new Date(),
    firstMessageSent: true,
  };

  if (isFirstMessage) {
    updates.smartCloseAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  }

  await db.update(matchesTable).set(updates as any).where(eq(matchesTable.id, String(matchId)));

  const mapped = mapMessage(message!);

  // Respond immediately, then do real-time + push in the background
  res.status(201).json(mapped);

  // Real-time: push to any open WebSocket subscribers for this match
  broadcastToMatch(String(matchId), { type: "new_message", message: mapped });

  // Push notification: send to the OTHER user if they have a token
  const recipientId = match.userA === userId ? match.userB : match.userA;
  try {
    const [sender, recipient] = await Promise.all([
      db.select({ fullName: profilesTable.fullName }).from(profilesTable).where(eq(profilesTable.id, userId)).limit(1),
      db.select({ pushNotificationToken: profilesTable.pushNotificationToken, language: profilesTable.language }).from(profilesTable).where(eq(profilesTable.id, recipientId)).limit(1),
    ]);

    const recipientLang = recipient[0]?.language ?? "en";
    const senderFullName = sender[0]?.fullName ?? "";
    const senderFirstName = senderFullName.trim().split(/\s+/)[0] || (recipientLang === "rw" ? "Uwo mwahujwe" : "Your match");
    const token = recipient[0]?.pushNotificationToken;

    const notificationTitle = recipientLang === "rw"
      ? `Ubutumwa buturuka kuri ${senderFirstName}`
      : `New message from ${senderFirstName}`;
    const notificationBody = recipientLang === "rw"
      ? "Ubutumwa bushya"
      : "New message";

    await sendPushNotification({
      to: token,
      title: notificationTitle,
      body: notificationBody,
      data: { matchId: String(matchId), screen: "chat" },
    });
  } catch {
    // non-fatal
  }
});

// POST /matches/:matchId/phase-complete
router.post("/matches/:matchId/phase-complete", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { matchId } = req.params;

  const [match] = await db
    .select()
    .from(matchesTable)
    .where(
      and(
        eq(matchesTable.id, String(matchId)),
        or(eq(matchesTable.userA, userId), eq(matchesTable.userB, userId)),
        eq(matchesTable.status, "active"),
      )
    )
    .limit(1);

  if (!match) {
    res.status(404).json({ error: "not_found", message: "Match not found" });
    return;
  }

  const isA = match.userA === userId;
  const phase = match.conversationPhase ?? 1;
  const updates: Record<string, boolean> = {};

  if (phase === 1) {
    updates[isA ? "phase1CompleteA" : "phase1CompleteB"] = true;
  } else if (phase === 2) {
    updates[isA ? "phase2CompleteA" : "phase2CompleteB"] = true;
  }

  const updatedA = phase === 1 ? (isA ? true : match.phase1CompleteA) : (isA ? true : match.phase2CompleteA);
  const updatedB = phase === 1 ? (!isA ? true : match.phase1CompleteB) : (!isA ? true : match.phase2CompleteB);

  if (updatedA && updatedB && phase < 3) {
    (updates as any).conversationPhase = phase + 1;
  }

  const [updated] = await db
    .update(matchesTable)
    .set(updates as any)
    .where(eq(matchesTable.id, String(matchId)))
    .returning();

  const isAFinal = updated!.userA === userId;
  const myPhaseComplete = updated!.conversationPhase === 1
    ? (isAFinal ? updated!.phase1CompleteA : updated!.phase1CompleteB)
    : updated!.conversationPhase === 2
    ? (isAFinal ? updated!.phase2CompleteA : updated!.phase2CompleteB)
    : true;

  const response = {
    id: updated!.id,
    otherUserId: isAFinal ? updated!.userB : updated!.userA,
    otherUserName: "—",
    otherUserAge: null,
    otherUserPrimaryPhoto: null,
    status: updated!.status,
    conversationPhase: updated!.conversationPhase ?? 1,
    assignedFirstUserId: updated!.assignedFirstUser ?? null,
    firstMessageSent: updated!.firstMessageSent ?? false,
    expiresAt: updated!.expiresAt?.toISOString() ?? new Date().toISOString(),
    lastMessageAt: updated!.lastMessageAt?.toISOString() ?? null,
    createdAt: updated!.createdAt?.toISOString() ?? new Date().toISOString(),
    myPhaseComplete: myPhaseComplete ?? false,
    unreadCount: 0,
  };

  res.json(response);

  // Notify the other user's WebSocket that the phase changed
  broadcastToMatch(String(matchId), { type: "phase_updated", match: response });
});

export default router;
