import { Router } from "express";
import { db, reportsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";

const router = Router();

// POST /reports
router.post("/reports", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { reportedUserId, reason, details } = req.body as {
    reportedUserId?: string;
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

  await db.insert(reportsTable).values({
    reporterId: userId,
    reportedId: reportedUserId,
    reason,
    details: details ?? null,
  });

  res.status(201).json({ message: "Report submitted. Our team will review it within 24 hours." });
});

export default router;
