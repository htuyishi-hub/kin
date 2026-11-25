import { Router } from "express";
import { eq, and, or, ne, sql, notExists, count, inArray, asc } from "drizzle-orm";
import {
  db,
  profilesTable,
  reportsTable,
  matchesTable,
  profilePhotosTable,
  talkRequestsTable,
} from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";
import { getStorageAdmin } from "../lib/storage.js";
import { logger } from "../lib/logger.js";

const router = Router();

function isRequestsEnabled(): boolean {
  return process.env.REQUESTS_ENABLED === "true";
}

function isMemberVerified(profile: {
  accountStatus?: string | null;
  profileActive?: boolean | null;
  profilePaused?: boolean | null;
  institutionVerified?: boolean | null;
  isVerified?: boolean | null;
  invitedByProfile?: string | null;
  vouchCount?: number | null;
}): boolean {
  if (profile.accountStatus !== "active") return false;
  if (profile.profileActive === false || profile.profilePaused === true) return false;
  return (
    Boolean(profile.institutionVerified) ||
    Boolean(profile.isVerified) ||
    Boolean(profile.invitedByProfile) ||
    (profile.vouchCount ?? 0) >= 1
  );
}

function calculateAge(dateOfBirth: string | Date): number {
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return 18;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return isNaN(age) ? 18 : age;
}

// GET /requests/pending — Pending "wants to talk" requests for current member
router.get("/requests/pending", requireAuth, async (req, res) => {
  if (!isRequestsEnabled()) {
    res.status(404).json({
      code: "FEATURE_DISABLED",
      error: "feature_disabled",
      message: "Requests feature is disabled",
    });
    return;
  }

  const userId = (req as AuthedRequest).userId;
  const [viewer] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);

  if (!viewer || !isMemberVerified(viewer)) {
    res.status(403).json({
      error: "forbidden",
      code: "VIEWER_NOT_ELIGIBLE",
      message: "Active verified status required",
    });
    return;
  }

  const viewerIntent = viewer.intentClass ?? viewer.primaryIntent ?? "Serious";
  const viewerTier = viewer.hiddenTier ?? 1;
  const viewerCrossing = viewer.crossingFeePaid ?? false;

  // Visibility conditions for senders of pending requests:
  // - Request is pending and unexpired
  // - Sender is active & verified
  // - Same primary intent
  // - Matchable under hidden tier & crossing rules
  // - Neither has reported or blocked the other
  // - Not already matched
  const conditions = [
    eq(talkRequestsTable.receiverId, userId),
    eq(talkRequestsTable.status, "pending"),
    sql`${talkRequestsTable.expiresAt} > now()`,

    // Sender active and verified
    eq(profilesTable.accountStatus, "active"),
    eq(profilesTable.profileActive, true),
    sql`(${profilesTable.profilePaused} IS FALSE OR ${profilesTable.profilePaused} IS NULL)`,
    sql`(${profilesTable.isVerified} = TRUE OR ${profilesTable.institutionVerified} = TRUE OR ${profilesTable.invitedByProfile} IS NOT NULL OR COALESCE(${profilesTable.vouchCount}, 0) >= 1)`,

    // Neither has reported or blocked the other
    notExists(
      db
        .select()
        .from(reportsTable)
        .where(
          or(
            and(eq(reportsTable.reporterId, userId), eq(reportsTable.reportedId, profilesTable.id)),
            and(eq(reportsTable.reporterId, profilesTable.id), eq(reportsTable.reportedId, userId))
          )
        )
    ),

    // No existing active match
    notExists(
      db
        .select()
        .from(matchesTable)
        .where(
          or(
            and(eq(matchesTable.userA, userId), eq(matchesTable.userB, profilesTable.id)),
            and(eq(matchesTable.userA, profilesTable.id), eq(matchesTable.userB, userId))
          )
        )
    ),
  ];

  const pendingRows = await db
    .select({
      id: talkRequestsTable.id,
      senderId: talkRequestsTable.senderId,
      createdAt: talkRequestsTable.createdAt,
      senderFullName: profilesTable.fullName,
      senderDateOfBirth: profilesTable.dateOfBirth,
      senderCampusName: profilesTable.campusName,
      senderFaculty: profilesTable.faculty,
      senderCity: profilesTable.city,
      senderDistrict: profilesTable.district,
      senderBio: profilesTable.bio,
      senderTags: profilesTable.tags,
      senderIsVerified: profilesTable.isVerified,
      senderInstitutionVerified: profilesTable.institutionVerified,
    })
    .from(talkRequestsTable)
    .innerJoin(profilesTable, eq(talkRequestsTable.senderId, profilesTable.id))
    .where(and(...conditions))
    .orderBy(asc(talkRequestsTable.createdAt))
    .limit(10);

  const senderIds = pendingRows.map((r) => r.senderId);

  // Batch query photos
  const photoRows =
    senderIds.length > 0
      ? await db
          .select({
            userId: profilePhotosTable.userId,
            storagePath: profilePhotosTable.storagePath,
            publicUrl: profilePhotosTable.publicUrl,
          })
          .from(profilePhotosTable)
          .where(inArray(profilePhotosTable.userId, senderIds))
          .orderBy(asc(profilePhotosTable.sortOrder))
      : [];

  const admin = getStorageAdmin();
  const photoMap = new Map<string, string>();
  for (const p of photoRows) {
    if (!photoMap.has(p.userId)) {
      if (admin && p.storagePath) {
        try {
          const { data } = await admin.storage.from("profile-photos").createSignedUrl(p.storagePath, 300);
          if (data?.signedUrl) {
            photoMap.set(p.userId, data.signedUrl);
            continue;
          }
        } catch {
          // fallback
        }
      }
      if (p.publicUrl) {
        photoMap.set(p.userId, p.publicUrl);
      }
    }
  }

  // Strip private data: only first name, age, campus, faculty, city, bio, tags.
  // NEVER return hidden_tier, scores, full name, phone, email, or date of birth.
  const requests = pendingRows.map((r) => {
    const rawName = r.senderFullName?.trim() ?? "kinn Member";
    const firstName = rawName.split(" ")[0] ?? "Member";
    const age = r.senderDateOfBirth ? calculateAge(r.senderDateOfBirth) : null;

    return {
      id: r.id,
      senderId: r.senderId,
      firstName,
      age,
      campusName: r.senderCampusName ?? null,
      faculty: r.senderFaculty ?? null,
      city: r.senderCity ?? null,
      district: r.senderDistrict ?? null,
      bio: r.senderBio ?? null,
      tags: (r.senderTags as string[]) ?? [],
      photoUrl: photoMap.get(r.senderId) ?? null,
      isVerified: Boolean(r.senderIsVerified || r.senderInstitutionVerified),
      createdAt: r.createdAt.toISOString(),
    };
  });

  res.json(requests);
});

// POST /requests — Send a "wants to talk" request
router.post("/requests", requireAuth, async (req, res) => {
  if (!isRequestsEnabled()) {
    res.status(404).json({
      code: "FEATURE_DISABLED",
      error: "feature_disabled",
      message: "Requests feature is disabled",
    });
    return;
  }

  const userId = (req as AuthedRequest).userId;
  const { toUserId } = req.body as { toUserId?: string };

  if (!toUserId || toUserId === userId) {
    res.status(400).json({ error: "bad_request", message: "Valid toUserId is required" });
    return;
  }

  const [viewer] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);
  if (!viewer || !isMemberVerified(viewer)) {
    res.status(403).json({
      error: "forbidden",
      code: "VIEWER_NOT_ELIGIBLE",
      message: "Active verified status required",
    });
    return;
  }

  // Check rate limit: REQUEST_DAILY_LIMIT (default 5)
  const REQUEST_DAILY_LIMIT = Number(process.env.REQUEST_DAILY_LIMIT ?? 5);
  const [dailyCount] = await db
    .select({ count: count() })
    .from(talkRequestsTable)
    .where(
      and(
        eq(talkRequestsTable.senderId, userId),
        sql`${talkRequestsTable.createdAt} >= CURRENT_DATE`
      )
    );

  if ((dailyCount?.count ?? 0) >= REQUEST_DAILY_LIMIT) {
    res.status(429).json({
      code: "REQUEST_DAILY_LIMIT",
      error: "rate_limited",
      message: "Daily request limit reached.",
    });
    return;
  }

  // Check duplicate pending request
  const existingPending = await db
    .select()
    .from(talkRequestsTable)
    .where(
      and(
        eq(talkRequestsTable.senderId, userId),
        eq(talkRequestsTable.receiverId, toUserId),
        eq(talkRequestsTable.status, "pending")
      )
    )
    .limit(1);

  if (existingPending.length > 0) {
    res.status(400).json({
      code: "DUPLICATE_REQUEST",
      error: "bad_request",
      message: "A request is already pending.",
    });
    return;
  }

  // Check already matched
  const existingMatch = await db
    .select()
    .from(matchesTable)
    .where(
      or(
        and(eq(matchesTable.userA, userId), eq(matchesTable.userB, toUserId)),
        and(eq(matchesTable.userA, toUserId), eq(matchesTable.userB, userId))
      )
    )
    .limit(1);

  if (existingMatch.length > 0) {
    res.status(400).json({
      code: "ALREADY_MATCHED",
      error: "bad_request",
      message: "Already matched with this member.",
    });
    return;
  }

  // Verify recipient eligibility and intent matching
  const [recipient] = await db.select().from(profilesTable).where(eq(profilesTable.id, toUserId)).limit(1);
  if (!recipient || !isMemberVerified(recipient)) {
    res.status(400).json({ error: "bad_request", message: "Recipient is not eligible" });
    return;
  }

  const viewerIntent = viewer.intentClass ?? viewer.primaryIntent ?? "Serious";
  const recipientIntent = recipient.intentClass ?? recipient.primaryIntent ?? "Serious";
  if (viewerIntent !== recipientIntent) {
    res.status(400).json({ error: "intent_mismatch", message: "Intent mismatch" });
    return;
  }

  // Insert request
  const [inserted] = await db
    .insert(talkRequestsTable)
    .values({
      senderId: userId,
      receiverId: toUserId,
      status: "pending",
    })
    .returning({ id: talkRequestsTable.id });

  res.status(201).json({
    success: true,
    requestId: inserted.id,
  });
});

// POST /requests/:requestId/accept — Accept "wants to talk" request and create match
router.post("/requests/:requestId/accept", requireAuth, async (req, res) => {
  if (!isRequestsEnabled()) {
    res.status(404).json({
      code: "FEATURE_DISABLED",
      error: "feature_disabled",
      message: "Requests feature is disabled",
    });
    return;
  }

  const userId = (req as AuthedRequest).userId;
  const requestId = req.params["requestId"] as string;

  const [requestRow] = await db
    .select()
    .from(talkRequestsTable)
    .where(
      and(
        eq(talkRequestsTable.id, requestId),
        eq(talkRequestsTable.receiverId, userId),
        eq(talkRequestsTable.status, "pending")
      )
    )
    .limit(1);

  if (!requestRow) {
    res.status(404).json({ error: "not_found", message: "Request not found or not pending" });
    return;
  }

  // Update status to accepted
  await db
    .update(talkRequestsTable)
    .set({
      status: "accepted",
      updatedAt: new Date(),
    })
    .where(eq(talkRequestsTable.id, requestId));

  // Check if match already exists
  const existingMatch = await db
    .select()
    .from(matchesTable)
    .where(
      or(
        and(eq(matchesTable.userA, requestRow.senderId), eq(matchesTable.userB, userId)),
        and(eq(matchesTable.userA, userId), eq(matchesTable.userB, requestRow.senderId))
      )
    )
    .limit(1);

  let matchId = existingMatch[0]?.id;

  if (!matchId) {
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const assignedFirstUser = Math.random() > 0.5 ? userId : requestRow.senderId;

    const [newMatch] = await db
      .insert(matchesTable)
      .values({
        userA: requestRow.senderId,
        userB: userId,
        assignedFirstUser,
        expiresAt,
      })
      .returning({ id: matchesTable.id });

    matchId = newMatch.id;
  }

  res.json({
    success: true,
    matchId,
  });
});

// POST /requests/:requestId/decline — Decline "wants to talk" request
router.post("/requests/:requestId/decline", requireAuth, async (req, res) => {
  if (!isRequestsEnabled()) {
    res.status(404).json({
      code: "FEATURE_DISABLED",
      error: "feature_disabled",
      message: "Requests feature is disabled",
    });
    return;
  }

  const userId = (req as AuthedRequest).userId;
  const requestId = req.params["requestId"] as string;

  const [requestRow] = await db
    .select()
    .from(talkRequestsTable)
    .where(
      and(
        eq(talkRequestsTable.id, requestId),
        eq(talkRequestsTable.receiverId, userId),
        eq(talkRequestsTable.status, "pending")
      )
    )
    .limit(1);

  if (!requestRow) {
    res.status(404).json({ error: "not_found", message: "Request not found or not pending" });
    return;
  }

  // Update status to declined (double-blind, no notification to sender)
  await db
    .update(talkRequestsTable)
    .set({
      status: "declined",
      updatedAt: new Date(),
    })
    .where(eq(talkRequestsTable.id, requestId));

  res.json({
    success: true,
  });
});

export default router;
