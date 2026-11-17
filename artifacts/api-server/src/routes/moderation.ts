import { Router } from "express";
import { eq, and, sql, notExists, ne, asc } from "drizzle-orm";
import { db, profilesTable, profilePhotosTable, vouchesTable, trustEventsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";

const router = Router();

// GET /moderation/queue — Review deck of waitlisted users awaiting community approval
router.get("/moderation/queue", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const limit = Math.min(Number(req.query["limit"] ?? 20), 50);

  // Verify approver is active and verified
  const [approver] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);

  if (!approver || approver.profileActive === false || (approver.accountStatus && approver.accountStatus !== "active")) {
    res.status(403).json({ error: "forbidden", message: "Only active members can access the Community Moderation deck." });
    return;
  }

  // Fetch waitlisted candidates not yet reviewed by current user
  const waitlisted = await db
    .select({
      id: profilesTable.id,
      fullName: profilesTable.fullName,
      approvalScore: profilesTable.approvalScore,
      createdAt: profilesTable.createdAt,
    })
    .from(profilesTable)
    .where(
      and(
        ne(profilesTable.id, userId),
        eq(profilesTable.accountStatus, "waitlisted"),
        // Exclude candidates already reviewed by current user
        notExists(
          db
            .select()
            .from(vouchesTable)
            .where(
              and(
                eq(vouchesTable.vouchedUser, profilesTable.id),
                eq(vouchesTable.voucher, userId),
              )
            )
        )
      )
    )
    .limit(limit);

  if (waitlisted.length === 0) {
    res.json([]);
    return;
  }

  const candidateIds = waitlisted.map((c) => c.id);

  // Fetch strictly up to 2 photos per candidate
  const photos = await db
    .select({
      userId: profilePhotosTable.userId,
      publicUrl: profilePhotosTable.publicUrl,
      sortOrder: profilePhotosTable.sortOrder,
    })
    .from(profilePhotosTable)
    .where(sql`${profilePhotosTable.userId} IN ${candidateIds}`)
    .orderBy(asc(profilePhotosTable.sortOrder));

  const photoMap = new Map<string, string[]>();
  for (const p of photos) {
    if (!photoMap.has(p.userId)) photoMap.set(p.userId, []);
    const list = photoMap.get(p.userId)!;
    if (list.length < 2 && p.publicUrl) {
      list.push(p.publicUrl);
    }
  }

  // Fetch distinct confirmed approver counts for candidates
  const vouchCounts = await db
    .select({
      candidateId: vouchesTable.vouchedUser,
      count: sql<number>`count(DISTINCT ${vouchesTable.voucher})`.mapWith(Number),
    })
    .from(vouchesTable)
    .where(and(sql`${vouchesTable.vouchedUser} IN ${candidateIds}`, eq(vouchesTable.status, "confirmed")))
    .groupBy(vouchesTable.vouchedUser);

  const approverCountMap = new Map<string, number>();
  for (const v of vouchCounts) {
    if (v.candidateId) approverCountMap.set(v.candidateId, v.count);
  }

  // Format teaser review cards (STRICT maximum 2 photos, First Name ONLY)
  const result = waitlisted.map((c) => {
    const rawName = c.fullName?.trim() ?? "Candidate";
    const firstName = rawName.split(" ")[0] ?? "Candidate";
    return {
      id: c.id,
      firstName,
      photos: photoMap.get(c.id) ?? [],
      approvalScore: c.approvalScore ?? 0,
      approverCount: approverCountMap.get(c.id) ?? 0,
      minApproversNeeded: 2,
      approvalThreshold: 5,
      accountStatus: "waitlisted",
    };
  });

  res.json(result);
});

// POST /moderation/approve — Hardened weighted community approval with Quorum & Velocity Guards
router.post("/moderation/approve", requireAuth, async (req, res) => {
  const approverId = (req as AuthedRequest).userId;
  const { candidateId } = req.body as { candidateId?: string };

  if (!candidateId) {
    res.status(400).json({ error: "bad_request", message: "candidateId is required" });
    return;
  }

  // Guard 1: Prevent self-approval
  if (approverId === candidateId) {
    res.status(400).json({ error: "bad_request", message: "Cannot approve yourself" });
    return;
  }

  const [approver] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, approverId))
    .limit(1);

  // Guard 2: Verify approver is active, verified, and in good standing
  if (
    !approver ||
    approver.profileActive === false ||
    (approver.accountStatus && approver.accountStatus !== "active") ||
    approver.isVerified === false
  ) {
    res.status(403).json({
      error: "forbidden",
      message: "Only active, verified members in good standing can approve candidates.",
    });
    return;
  }

  // Guard 3: Minimum Trust Score of 10 required
  const approverTrust = approver.trustScore ?? 1;
  if (approverTrust < 10) {
    res.status(403).json({
      error: "forbidden",
      message: `Minimum Trust Score of 10 required to participate in community approvals (your score: ${approverTrust}).`,
    });
    return;
  }

  // Guard 4: Velocity Guards — max 5 approvals per 24 hours, and 10s cooldown
  const recentApprovals = await db
    .select({
      count: sql<number>`count(*)`.mapWith(Number),
      lastConfirmedAt: sql<string>`max(${vouchesTable.confirmedAt})`,
    })
    .from(vouchesTable)
    .where(
      and(
        eq(vouchesTable.voucher, approverId),
        sql`${vouchesTable.confirmedAt} > now() - interval '24 hours'`
      )
    );

  const dailyCount = recentApprovals[0]?.count ?? 0;
  if (dailyCount >= 5) {
    res.status(429).json({
      error: "too_many_requests",
      message: "Daily approval limit reached (5 approvals/24h). Please wait before reviewing more candidates.",
    });
    return;
  }

  const lastConfirmedAtStr = recentApprovals[0]?.lastConfirmedAt;
  if (lastConfirmedAtStr) {
    const elapsedMs = Date.now() - new Date(lastConfirmedAtStr).getTime();
    if (elapsedMs < 10000) {
      res.status(429).json({
        error: "too_many_requests",
        message: "Approval velocity too high. Please review candidate profiles carefully.",
      });
      return;
    }
  }

  // Guard 5: Verify candidate exists
  const [candidate] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, candidateId))
    .limit(1);

  if (!candidate) {
    res.status(404).json({ error: "not_found", message: "Candidate not found" });
    return;
  }

  if (candidate.accountStatus === "active") {
    res.json({
      success: true,
      message: "Candidate is already active on Kin.",
      activated: true,
      candidateId,
    });
    return;
  }

  // Non-linear bounded voting weight (capped at max 3 points)
  const weight = approverTrust >= 80 ? 3 : approverTrust >= 40 ? 2 : 1;

  let activated = false;
  let newApprovalScore = 0;
  let distinctApproverCount = 0;
  const MIN_DISTINCT_APPROVERS = 2;
  const MIN_APPROVAL_SCORE = 5;

  await db.transaction(async (tx) => {
    // Record confirmed approval in vouches
    const existing = await tx
      .select()
      .from(vouchesTable)
      .where(and(eq(vouchesTable.vouchedUser, candidateId), eq(vouchesTable.voucher, approverId)))
      .limit(1);

    if (existing[0]) {
      await tx
        .update(vouchesTable)
        .set({ status: "confirmed", confirmedAt: new Date() })
        .where(eq(vouchesTable.id, existing[0].id));
    } else {
      await tx.insert(vouchesTable).values({
        vouchedUser: candidateId,
        voucher: approverId,
        status: "confirmed",
        confirmedAt: new Date(),
      });
    }

    // Add approver bounded weight to candidate approval_score
    const [updatedCandidate] = await tx
      .update(profilesTable)
      .set({
        approvalScore: sql`COALESCE(${profilesTable.approvalScore}, 0) + ${weight}`,
        vouchCount: sql`COALESCE(${profilesTable.vouchCount}, 0) + 1`,
      })
      .where(eq(profilesTable.id, candidateId))
      .returning({ approvalScore: profilesTable.approvalScore });

    newApprovalScore = updatedCandidate?.approvalScore ?? 0;

    // Count distinct confirmed approvers (QUORUM REQUIREMENT)
    const [{ count }] = await tx
      .select({ count: sql<number>`count(DISTINCT ${vouchesTable.voucher})`.mapWith(Number) })
      .from(vouchesTable)
      .where(and(eq(vouchesTable.vouchedUser, candidateId), eq(vouchesTable.status, "confirmed")));

    distinctApproverCount = count;

    // Strict Quorum: Must have AT LEAST 2 distinct approvers AND approval_score >= 5.
    // No single user can ever activate an applicant alone!
    if (distinctApproverCount >= MIN_DISTINCT_APPROVERS && newApprovalScore >= MIN_APPROVAL_SCORE) {
      await tx
        .update(profilesTable)
        .set({
          accountStatus: "active",
          isVerified: true,
          profileActive: true,
        })
        .where(eq(profilesTable.id, candidateId));
      activated = true;
    }

    // Log trust audit event for approver (+2 delta)
    await tx.insert(trustEventsTable).values({
      userId: approverId,
      eventType: "approved_candidate",
      delta: 2,
      sourceId: candidateId,
    });
  });

  res.json({
    success: true,
    message: activated
      ? "Candidate reached community quorum and is now active on Kin!"
      : `Approval recorded with +${weight} weight. Needs ${Math.max(
          0,
          MIN_DISTINCT_APPROVERS - distinctApproverCount
        )} more independent approver(s).`,
    weightAdded: weight,
    newApprovalScore,
    distinctApprovers: distinctApproverCount,
    minApproversNeeded: MIN_DISTINCT_APPROVERS,
    approvalThreshold: MIN_APPROVAL_SCORE,
    activated,
    candidateId,
  });
});

// POST /moderation/deny — Community denial
router.post("/moderation/deny", requireAuth, async (req, res) => {
  const approverId = (req as AuthedRequest).userId;
  const { candidateId, reason } = req.body as { candidateId?: string; reason?: string };

  if (!candidateId) {
    res.status(400).json({ error: "bad_request", message: "candidateId is required" });
    return;
  }

  // Record denial so candidate is not presented to this reviewer again
  const existing = await db
    .select()
    .from(vouchesTable)
    .where(and(eq(vouchesTable.vouchedUser, candidateId), eq(vouchesTable.voucher, approverId)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(vouchesTable)
      .set({ status: "revoked", confirmedAt: new Date() })
      .where(eq(vouchesTable.id, existing[0].id));
  } else {
    await db.insert(vouchesTable).values({
      vouchedUser: candidateId,
      voucher: approverId,
      status: "revoked",
      confirmedAt: new Date(),
    });
  }

  res.json({
    success: true,
    message: "Candidate denied entry.",
    candidateId,
  });
});

export default router;
