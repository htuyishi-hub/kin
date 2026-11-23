import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, reportsTable, messagesTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";

const router = Router();

// POST /reports
router.post("/reports", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { reportedUserId, matchId, reason, details } = req.body as {
    reportedUserId?: string;
    matchId?: string;
    reason?: string;
    details?: string;
  };

  if (!reportedUserId || !reason) {
    res.status(400).json({ error: "bad_request", message: "reportedUserId and reason are required" });
    return;
  }

  const validReasons = ["exploitation", "wrong_intent", "harassment", "fake_profile", "underage", "other"];
  if (!validReasons.includes(reason)) {
    res.status(400).json({ error: "bad_request", message: "Invalid reason" });
    return;
  }

  let reportDetails = details ?? "";
  if (matchId) {
    try {
      const recentMessages = await db
        .select()
        .from(messagesTable)
        .where(eq(messagesTable.matchId, String(matchId)))
        .orderBy(desc(messagesTable.createdAt))
        .limit(30);

      if (recentMessages.length > 0) {
        const snapshot = recentMessages
          .reverse()
          .map((m) => `[${m.createdAt?.toISOString()}] ${m.senderId === userId ? "Reporter" : "Reported"}: ${m.deletedAt ? "[DELETED]" : m.content}`)
          .join("\n");
        reportDetails = reportDetails
          ? `${reportDetails}\n\n--- Chat Snapshot (Last 30 Messages) ---\n${snapshot}`
          : `--- Chat Snapshot (Last 30 Messages) ---\n${snapshot}`;
      }
    } catch (snapErr) {
      console.warn("Failed to capture chat snapshot for report:", snapErr);
    }
  }

  await db.insert(reportsTable).values({
    reporterId: userId,
    reportedId: reportedUserId,
    reason,
    details: reportDetails || null,
  });

  res.status(201).json({ message: "Report submitted. Our team will review it within 24 hours." });
});

export default router;
