import { Router } from "express";
import { eq, and, or, desc, ne, isNull, inArray } from "drizzle-orm";
import { db, messagesTable, messageEditsTable, matchesTable, profilesTable } from "@workspace/db";
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

interface ReplyPreview {
  id: string;
  senderId: string;
  content: string;
}

function mapMessage(
  m: typeof messagesTable.$inferSelect,
  viewerId?: string,
  bothReadReceiptsEnabled: boolean = false,
  replyMap?: Map<string, ReplyPreview>
) {
  const isDeleted = Boolean(m.deletedAt);
  const isSender = viewerId && m.senderId === viewerId;

  // Read receipts: if viewing own message as sender, only reveal readAt if BOTH users have read receipts enabled
  let exposedReadAt: string | null = null;
  if (m.readAt) {
    if (!isSender) {
      exposedReadAt = m.readAt.toISOString();
    } else if (bothReadReceiptsEnabled) {
      exposedReadAt = m.readAt.toISOString();
    }
  }

  const replyTo = m.replyToId ? replyMap?.get(m.replyToId) ?? null : null;

  return {
    id: m.id,
    matchId: m.matchId,
    senderId: m.senderId,
    content: isDeleted ? "" : m.content,
    phase: m.phase ?? 1,
    promptKey: m.promptKey ?? null,
    promptText: null as string | null,
    isSystem: m.isSystem ?? false,
    readAt: exposedReadAt,
    replyToId: m.replyToId ?? null,
    replyTo,
    editedAt: m.editedAt?.toISOString() ?? null,
    deletedAt: m.deletedAt?.toISOString() ?? null,
    deliveredAt: m.deliveredAt?.toISOString() ?? null,
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
        or(eq(matchesTable.userA, userId), eq(matchesTable.userB, userId))
      )
    )
    .limit(1);

  if (!match) {
    res.status(404).json({ error: "not_found", message: "Match not found" });
    return;
  }

  // Fetch both users' profiles to determine mutual read receipt preference
  const [profileA, profileB] = await Promise.all([
    db.select({ readReceiptsEnabled: profilesTable.readReceiptsEnabled }).from(profilesTable).where(eq(profilesTable.id, match.userA)).limit(1),
    db.select({ readReceiptsEnabled: profilesTable.readReceiptsEnabled }).from(profilesTable).where(eq(profilesTable.id, match.userB)).limit(1),
  ]);

  const bothReadReceiptsEnabled = Boolean(
    profileA[0]?.readReceiptsEnabled && profileB[0]?.readReceiptsEnabled
  );

  // Delivery receipt: mark un-delivered messages sent to the current user as delivered
  const now = new Date();
  const deliveryResult = await db
    .update(messagesTable)
    .set({ deliveredAt: now })
    .where(
      and(
        eq(messagesTable.matchId, String(matchId)),
        ne(messagesTable.senderId, userId),
        isNull(messagesTable.deliveredAt)
      )
    )
    .returning({ id: messagesTable.id });

  if (deliveryResult.length > 0) {
    broadcastToMatch(String(matchId), {
      type: "messages_delivered",
      matchId: String(matchId),
      deliveredAt: now.toISOString(),
    });
  }

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.matchId, String(matchId)))
    .orderBy(desc(messagesTable.createdAt))
    .limit(limit);

  // Collect replyToIds to resolve reply previews
  const replyToIds = messages
    .map((m) => m.replyToId)
    .filter((id): id is string => Boolean(id));

  const replyMap = new Map<string, ReplyPreview>();
  if (replyToIds.length > 0) {
    const parentMessages = await db
      .select({
        id: messagesTable.id,
        senderId: messagesTable.senderId,
        content: messagesTable.content,
        deletedAt: messagesTable.deletedAt,
      })
      .from(messagesTable)
      .where(inArray(messagesTable.id, replyToIds));

    for (const pm of parentMessages) {
      replyMap.set(pm.id, {
        id: pm.id,
        senderId: pm.senderId,
        content: pm.deletedAt ? "" : pm.content,
      });
    }
  }

  res.json(
    messages
      .reverse()
      .map((m) => mapMessage(m, userId, bothReadReceiptsEnabled, replyMap))
  );
});

// POST /matches/:matchId/messages
router.post("/matches/:matchId/messages", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { matchId } = req.params;
  const { content, promptKey, replyToId } = req.body as {
    content?: string;
    promptKey?: string;
    replyToId?: string;
  };

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
        eq(matchesTable.status, "active")
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

  // Validate replyToId if provided
  let parentReply: ReplyPreview | null = null;
  if (replyToId) {
    const [parent] = await db
      .select({
        id: messagesTable.id,
        matchId: messagesTable.matchId,
        senderId: messagesTable.senderId,
        content: messagesTable.content,
        deletedAt: messagesTable.deletedAt,
      })
      .from(messagesTable)
      .where(and(eq(messagesTable.id, replyToId), eq(messagesTable.matchId, String(matchId))))
      .limit(1);

    if (parent) {
      parentReply = {
        id: parent.id,
        senderId: parent.senderId,
        content: parent.deletedAt ? "" : parent.content,
      };
    }
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
      replyToId: parentReply ? replyToId : null,
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

  const replyMap = new Map<string, ReplyPreview>();
  if (parentReply && message!.replyToId) {
    replyMap.set(message!.replyToId, parentReply);
  }

  const [profileA, profileB] = await Promise.all([
    db.select({ readReceiptsEnabled: profilesTable.readReceiptsEnabled }).from(profilesTable).where(eq(profilesTable.id, match.userA)).limit(1),
    db.select({ readReceiptsEnabled: profilesTable.readReceiptsEnabled }).from(profilesTable).where(eq(profilesTable.id, match.userB)).limit(1),
  ]);
  const bothReadReceiptsEnabled = Boolean(
    profileA[0]?.readReceiptsEnabled && profileB[0]?.readReceiptsEnabled
  );

  const mapped = mapMessage(message!, userId, bothReadReceiptsEnabled, replyMap);

  // Respond immediately
  res.status(201).json(mapped);

  // Broadcast over WebSocket to subscribers
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

// POST /matches/:matchId/read
router.post("/matches/:matchId/read", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { matchId } = req.params;

  const [match] = await db
    .select()
    .from(matchesTable)
    .where(
      and(
        eq(matchesTable.id, String(matchId)),
        or(eq(matchesTable.userA, userId), eq(matchesTable.userB, userId))
      )
    )
    .limit(1);

  if (!match) {
    res.status(404).json({ error: "not_found", message: "Match not found" });
    return;
  }

  const now = new Date();
  await db
    .update(messagesTable)
    .set({ readAt: now })
    .where(
      and(
        eq(messagesTable.matchId, String(matchId)),
        ne(messagesTable.senderId, userId),
        isNull(messagesTable.readAt)
      )
    );

  const [profileA, profileB] = await Promise.all([
    db.select({ readReceiptsEnabled: profilesTable.readReceiptsEnabled }).from(profilesTable).where(eq(profilesTable.id, match.userA)).limit(1),
    db.select({ readReceiptsEnabled: profilesTable.readReceiptsEnabled }).from(profilesTable).where(eq(profilesTable.id, match.userB)).limit(1),
  ]);
  const bothReadReceiptsEnabled = Boolean(
    profileA[0]?.readReceiptsEnabled && profileB[0]?.readReceiptsEnabled
  );

  if (bothReadReceiptsEnabled) {
    broadcastToMatch(String(matchId), {
      type: "messages_read",
      matchId: String(matchId),
      readAt: now.toISOString(),
    });
  }

  res.json({ success: true, readAt: now.toISOString() });
});

// PATCH /messages/:messageId
router.patch("/messages/:messageId", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { messageId } = req.params;
  const { content } = req.body as { content?: string };

  if (!content || content.trim().length === 0) {
    res.status(400).json({ error: "bad_request", message: "content is required" });
    return;
  }

  if (content.length > 1000) {
    res.status(400).json({ error: "bad_request", message: "Message too long (max 1000 chars)" });
    return;
  }

  const [message] = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.id, String(messageId)))
    .limit(1);

  if (!message) {
    res.status(404).json({ error: "not_found", message: "Message not found" });
    return;
  }

  if (message.senderId !== userId) {
    res.status(403).json({ error: "forbidden", message: "Cannot edit another user's message" });
    return;
  }

  if (message.deletedAt) {
    res.status(400).json({ error: "bad_request", message: "Cannot edit a deleted message" });
    return;
  }

  if (message.isSystem) {
    res.status(400).json({ error: "bad_request", message: "Cannot edit system messages" });
    return;
  }

  // 15-minute edit window check
  const createdTime = new Date(message.createdAt ?? Date.now()).getTime();
  const elapsedMs = Date.now() - createdTime;
  if (elapsedMs > 15 * 60 * 1000) {
    res.status(400).json({
      error: "bad_request",
      message: "Messages can only be edited within 15 minutes of sending",
    });
    return;
  }

  // Save audit history in message_edits table
  await db.insert(messageEditsTable).values({
    messageId: message.id,
    previousContent: message.content,
  });

  const now = new Date();
  const [updated] = await db
    .update(messagesTable)
    .set({
      content: content.trim(),
      editedAt: now,
    })
    .where(eq(messagesTable.id, message.id))
    .returning();

  // Determine read receipt preference for mapping
  const [match] = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.id, message.matchId))
    .limit(1);

  let bothReadReceiptsEnabled = false;
  if (match) {
    const [pA, pB] = await Promise.all([
      db.select({ readReceiptsEnabled: profilesTable.readReceiptsEnabled }).from(profilesTable).where(eq(profilesTable.id, match.userA)).limit(1),
      db.select({ readReceiptsEnabled: profilesTable.readReceiptsEnabled }).from(profilesTable).where(eq(profilesTable.id, match.userB)).limit(1),
    ]);
    bothReadReceiptsEnabled = Boolean(pA[0]?.readReceiptsEnabled && pB[0]?.readReceiptsEnabled);
  }

  const mapped = mapMessage(updated!, userId, bothReadReceiptsEnabled);

  // Broadcast edit to match room
  broadcastToMatch(message.matchId, { type: "message_edited", message: mapped });

  res.json(mapped);
});

// DELETE /messages/:messageId
router.delete("/messages/:messageId", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { messageId } = req.params;

  const [message] = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.id, String(messageId)))
    .limit(1);

  if (!message) {
    res.status(404).json({ error: "not_found", message: "Message not found" });
    return;
  }

  if (message.senderId !== userId) {
    res.status(403).json({ error: "forbidden", message: "Cannot delete another user's message" });
    return;
  }

  const now = new Date();
  await db
    .update(messagesTable)
    .set({ deletedAt: now })
    .where(eq(messagesTable.id, message.id));

  // Broadcast deletion to match room
  broadcastToMatch(message.matchId, {
    type: "message_deleted",
    messageId: message.id,
    matchId: message.matchId,
    deletedAt: now.toISOString(),
  });

  res.json({ success: true, id: message.id });
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
        eq(matchesTable.status, "active")
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
