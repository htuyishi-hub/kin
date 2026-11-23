import { Router } from "express";
import { randomUUID } from "crypto";
import { eq, and, or, sql, notExists, desc, lt, count, inArray } from "drizzle-orm";
import {
  db,
  profilesTable,
  reportsTable,
  postsTable,
  postLikesTable,
  postHidesTable,
  postImpressionsTable,
} from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";
import { getStorageAdmin } from "../lib/storage.js";
import { logger } from "../lib/logger.js";

const router = Router();

// Flag check
function isFeedEnabled(): boolean {
  return process.env.FEED_ENABLED === "true";
}

// Verification and active status helper
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

// Age calculator
function calculateAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

// Bio / Post Contact info filter (same rules as bio)
function containsContactInfo(text: string): boolean {
  if (!text) return false;

  // 1. Phone numbers: Rwandan patterns (07..., +250..., 250...) or 9+ digits
  const phonePattern = /(?:\+?250[\s.-]*)?0?7[2389][\s.-]*(?:\d[\s.-]*){7}/;
  const genericDigitsPattern = /(?:\d[\s.-]*){9,}/;
  if (phonePattern.test(text) || genericDigitsPattern.test(text)) {
    return true;
  }

  // 2. Email addresses
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  if (emailPattern.test(text)) {
    return true;
  }

  // 3. URLs, protocols or common domain extensions
  const urlPattern = /(?:https?:\/\/|www\.|\b\S+\.(?:com|rw|org|net|io|me|app|info|co|xyz|gov|edu)\b)/i;
  if (urlPattern.test(text)) {
    return true;
  }

  // 4. Social handles: @username
  const handlePattern = /@[\w.]{2,}/;
  if (handlePattern.test(text)) {
    return true;
  }

  // 5. Social / chat app keywords
  const socialKeywordsPattern = /\b(?:whatsapp|telegram|instagram|insta|snapchat|snap|tiktok|facebook|fb|ig)\b/i;
  if (socialKeywordsPattern.test(text)) {
    return true;
  }

  return false;
}

// =============================================================================
// POST MEDIA ENDPOINTS
// =============================================================================

// POST /posts/media/upload-url
router.post("/posts/media/upload-url", requireAuth, async (req, res) => {
  if (!isFeedEnabled()) {
    res.status(404).json({ error: "not_found", code: "FEATURE_DISABLED", message: "Posts feed is disabled" });
    return;
  }

  const userId = (req as AuthedRequest).userId;
  const [userProfile] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);

  if (!userProfile || !isMemberVerified(userProfile)) {
    res.status(403).json({ error: "forbidden", code: "USER_NOT_ELIGIBLE", message: "Active verified status required" });
    return;
  }

  const path = `posts/${userId}/${randomUUID()}.jpg`;
  const admin = getStorageAdmin();
  if (!admin) {
    res.status(503).json({ error: "storage_not_configured", code: "STORAGE_NOT_CONFIGURED" });
    return;
  }

  const { data, error } = await admin.storage
    .from("post-photos")
    .createSignedUploadUrl(path);

  if (error || !data) {
    res.status(500).json({ error: "storage_error", message: error?.message });
    return;
  }

  res.json({
    uploadUrl: data.signedUrl,
    token: data.token,
    path,
    expiresIn: 120,
  });
});

// POST /posts/media/confirm
router.post("/posts/media/confirm", requireAuth, async (req, res) => {
  if (!isFeedEnabled()) {
    res.status(404).json({ error: "not_found", code: "FEATURE_DISABLED", message: "Posts feed is disabled" });
    return;
  }

  const userId = (req as AuthedRequest).userId;
  const { path } = req.body as { path?: string };

  if (!path || typeof path !== "string" || !path.startsWith(`posts/${userId}/`) || !path.endsWith(".jpg")) {
    res.status(400).json({ error: "invalid_path", code: "INVALID_PATH", message: "Invalid photo path" });
    return;
  }

  const admin = getStorageAdmin();
  if (!admin) {
    res.status(503).json({ error: "storage_not_configured", code: "STORAGE_NOT_CONFIGURED" });
    return;
  }

  const { data: blob, error: downloadError } = await admin.storage
    .from("post-photos")
    .download(path);

  if (downloadError || !blob) {
    res.status(400).json({ error: "file_not_found", code: "FILE_NOT_FOUND", message: "Uploaded file not found" });
    return;
  }

  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Check size: cap 500 KB (512,000 bytes)
  if (buffer.length > 500 * 1024) {
    await admin.storage.from("post-photos").remove([path]);
    res.status(400).json({ error: "file_too_large", code: "FILE_TOO_LARGE", message: "Photo exceeds 500 KB" });
    return;
  }

  // Check JPEG magic bytes: 0xFF, 0xD8, 0xFF
  if (buffer.length < 3 || buffer[0] !== 0xFF || buffer[1] !== 0xD8 || buffer[2] !== 0xFF) {
    await admin.storage.from("post-photos").remove([path]);
    res.status(400).json({ error: "invalid_format", code: "INVALID_IMAGE_FORMAT", message: "Only JPEG images are permitted" });
    return;
  }

  res.json({
    path,
    confirmed: true,
  });
});

// =============================================================================
// POSTS CRUD ENDPOINTS
// =============================================================================

// POST /posts — Create a new post
router.post("/posts", requireAuth, async (req, res) => {
  if (!isFeedEnabled()) {
    res.status(404).json({ error: "not_found", code: "FEATURE_DISABLED", message: "Posts feed is disabled" });
    return;
  }

  const userId = (req as AuthedRequest).userId;
  const [userProfile] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);

  if (!userProfile || !isMemberVerified(userProfile)) {
    res.status(403).json({ error: "forbidden", code: "USER_NOT_ELIGIBLE", message: "Active verified status required" });
    return;
  }

  const { text, photoPaths } = req.body as { text?: string; photoPaths?: string[] };

  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "bad_request", code: "INVALID_TEXT", message: "Post text is required" });
    return;
  }

  const trimmedText = text.trim();
  if (trimmedText.length === 0 || trimmedText.length > 200) {
    res.status(400).json({ error: "bad_request", code: "POST_TOO_LONG", message: "Post must be 200 characters or fewer" });
    return;
  }

  if (containsContactInfo(trimmedText)) {
    res.status(400).json({ error: "bad_request", code: "POST_CONTACT_INFO", message: "Contact information is not allowed in posts" });
    return;
  }

  // Validate photos: max 2 photos
  const safePhotoPaths: string[] = [];
  if (Array.isArray(photoPaths)) {
    if (photoPaths.length > 2) {
      res.status(400).json({ error: "bad_request", code: "TOO_MANY_PHOTOS", message: "Maximum 2 photos per post" });
      return;
    }
    for (const p of photoPaths) {
      if (typeof p === "string" && p.startsWith(`posts/${userId}/`) && p.endsWith(".jpg")) {
        safePhotoPaths.push(p);
      }
    }
  }

  // 1. Max 1 post per day
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentPosts = await db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(and(eq(postsTable.authorId, userId), sql`${postsTable.createdAt} >= ${oneDayAgo}`))
    .limit(1);

  if (recentPosts.length > 0) {
    res.status(400).json({ error: "limit_reached", code: "POST_DAILY_LIMIT", message: "Maximum 1 post per day" });
    return;
  }

  // 2. Max 3 live posts
  const activePosts = await db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(and(eq(postsTable.authorId, userId), eq(postsTable.hidden, false), sql`${postsTable.expiresAt} > now()`));

  if (activePosts.length >= 3) {
    res.status(400).json({ error: "limit_reached", code: "MAX_ACTIVE_POSTS", message: "Maximum 3 live posts" });
    return;
  }

  // 3. Posts expire after 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [newPost] = await db
    .insert(postsTable)
    .values({
      authorId: userId,
      text: trimmedText,
      photoPaths: safePhotoPaths,
      expiresAt,
      hidden: false,
      likeCount: 0,
      impressions: 0,
    })
    .returning();

  // Generate 5-minute signed URLs for own photos
  const admin = getStorageAdmin();
  const photoUrls: string[] = [];
  if (admin && newPost!.photoPaths && newPost!.photoPaths.length > 0) {
    for (const p of newPost!.photoPaths) {
      const { data } = await admin.storage.from("post-photos").createSignedUrl(p, 300);
      if (data?.signedUrl) photoUrls.push(data.signedUrl);
    }
  }

  const firstName = userProfile.fullName?.trim().split(" ")[0] ?? "Member";
  const age = calculateAge(userProfile.dateOfBirth);
  const location = userProfile.campusName || userProfile.city || null;
  const isVerified = Boolean(userProfile.isVerified || userProfile.institutionVerified);

  res.status(201).json({
    id: newPost!.id,
    authorId: newPost!.authorId,
    firstName,
    age,
    location,
    isVerified,
    text: newPost!.text,
    photoUrls,
    createdAt: newPost!.createdAt.toISOString(),
    isLiked: false,
    isOwn: true,
    likeCount: null, // author sees count only when > 0
  });
});

// GET /posts — Feed query
router.get("/posts", requireAuth, async (req, res) => {
  if (!isFeedEnabled()) {
    res.status(404).json({ error: "not_found", code: "FEATURE_DISABLED", message: "Posts feed is disabled" });
    return;
  }

  const userId = (req as AuthedRequest).userId;
  const [viewer] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);

  if (!viewer || !isMemberVerified(viewer)) {
    res.status(403).json({ error: "forbidden", code: "VIEWER_NOT_ELIGIBLE", message: "Active verified status required" });
    return;
  }

  const FEED_MAX_IMPRESSIONS = Number(process.env.FEED_MAX_IMPRESSIONS ?? 40);
  const viewerIntent = viewer.intentClass ?? viewer.primaryIntent ?? "Serious";
  const viewerTier = viewer.hiddenTier ?? 1;
  const viewerCrossing = viewer.crossingFeePaid ?? false;

  // 1. Viewer daily impression cap: max 30 distinct posts per day
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const todayImpressions = await db
    .select({ count: count() })
    .from(postImpressionsTable)
    .where(and(eq(postImpressionsTable.viewerId, userId), sql`${postImpressionsTable.createdAt} >= ${oneDayAgo}`));

  const totalImpressionsToday = todayImpressions[0]?.count ?? 0;
  if (totalImpressionsToday >= 30) {
    res.json({
      posts: [],
      nextCursor: null,
      totalImpressionsToday,
    });
    return;
  }

  const limitParam = Math.min(Math.max(Number(req.query["limit"] ?? 10), 1), 20);
  const remainingAllowance = 30 - totalImpressionsToday;
  const effectiveLimit = Math.min(limitParam, remainingAllowance);

  const cursor = req.query["cursor"] as string | undefined;
  const cursorDate = cursor ? new Date(cursor) : null;

  // Build visibility conditions:
  // - Post not hidden and not expired
  // - Author verified and active
  // - Same primary intent
  // - Matchable under hidden tier & crossing rules
  // - Neither blocked nor reported the other
  // - Author not hidden by viewer
  // - Exposure cap: impressions < FEED_MAX_IMPRESSIONS OR viewer has already viewed it
  const baseConditions = [
    eq(postsTable.hidden, false),
    sql`${postsTable.expiresAt} > now()`,
    cursorDate && !isNaN(cursorDate.getTime()) ? lt(postsTable.createdAt, cursorDate) : undefined,

    // Author active and verified
    eq(profilesTable.accountStatus, "active"),
    eq(profilesTable.profileActive, true),
    sql`(${profilesTable.profilePaused} IS FALSE OR ${profilesTable.profilePaused} IS NULL)`,
    sql`(${profilesTable.isVerified} = TRUE OR ${profilesTable.institutionVerified} = TRUE OR ${profilesTable.invitedByProfile} IS NOT NULL OR COALESCE(${profilesTable.vouchCount}, 0) >= 1)`,

    // Intent Gating: STRICTLY identical intent
    eq(sql`COALESCE(${profilesTable.intentClass}, ${profilesTable.primaryIntent})`, viewerIntent),

    // Hidden Tier & Crossing Rules
    sql`(
      ${profilesTable.hiddenTier} = ${viewerTier}
      OR (
        (${viewerCrossing} = TRUE OR ${profilesTable.crossingFeePaid} = TRUE)
        AND ${viewerIntent} IN ('Marriage', 'Serious Marriage')
        AND ${profilesTable.hiddenTier} IN (1, 2)
        AND ${viewerTier} IN (1, 2)
      )
    )`,

    // Neither has reported or blocked the other
    notExists(
      db
        .select()
        .from(reportsTable)
        .where(
          or(
            and(eq(reportsTable.reporterId, userId), eq(reportsTable.reportedId, postsTable.authorId)),
            and(eq(reportsTable.reporterId, postsTable.authorId), eq(reportsTable.reportedId, userId))
          )
        )
    ),

    // Author not hidden by viewer
    notExists(
      db
        .select()
        .from(postHidesTable)
        .where(and(eq(postHidesTable.userId, userId), eq(postHidesTable.authorId, postsTable.authorId)))
    ),

    // Exposure cap
    sql`(
      ${postsTable.impressions} < ${FEED_MAX_IMPRESSIONS}
      OR EXISTS (
        SELECT 1 FROM post_impressions
        WHERE post_id = ${postsTable.id} AND viewer_id = ${userId}
      )
    )`,
  ].filter(Boolean);

  const candidatePosts = await db
    .select({
      id: postsTable.id,
      authorId: postsTable.authorId,
      text: postsTable.text,
      photoPaths: postsTable.photoPaths,
      createdAt: postsTable.createdAt,
      likeCount: postsTable.likeCount,
      impressions: postsTable.impressions,
      authorFullName: profilesTable.fullName,
      authorDateOfBirth: profilesTable.dateOfBirth,
      authorCampusName: profilesTable.campusName,
      authorCity: profilesTable.city,
      authorIsVerified: profilesTable.isVerified,
      authorInstitutionVerified: profilesTable.institutionVerified,
    })
    .from(postsTable)
    .innerJoin(profilesTable, eq(postsTable.authorId, profilesTable.id))
    .where(and(...baseConditions))
    .orderBy(desc(postsTable.createdAt)) // ORDERING: Newest first. Never by likes!
    .limit(effectiveLimit);

  if (candidatePosts.length === 0) {
    res.json({
      posts: [],
      nextCursor: null,
      totalImpressionsToday,
    });
    return;
  }

  const postIds = candidatePosts.map((p) => p.id);

  // Fetch likes from viewer
  const viewerLikes = await db
    .select({ postId: postLikesTable.postId })
    .from(postLikesTable)
    .where(and(eq(postLikesTable.userId, userId), inArray(postLikesTable.postId, postIds)));
  const likedPostIds = new Set(viewerLikes.map((l) => l.postId));

  // Check existing impressions to track new ones
  const existingImpressions = await db
    .select({ postId: postImpressionsTable.postId })
    .from(postImpressionsTable)
    .where(and(eq(postImpressionsTable.viewerId, userId), inArray(postImpressionsTable.postId, postIds)));
  const recordedImpressionPostIds = new Set(existingImpressions.map((i) => i.postId));

  // Track impressions for unrecorded posts
  const newImpressionPostIds = postIds.filter((id) => !recordedImpressionPostIds.has(id));
  if (newImpressionPostIds.length > 0) {
    try {
      await db
        .insert(postImpressionsTable)
        .values(newImpressionPostIds.map((pId) => ({ postId: pId, viewerId: userId })))
        .onConflictDoNothing();

      await db
        .update(postsTable)
        .set({ impressions: sql`${postsTable.impressions} + 1` })
        .where(inArray(postsTable.id, newImpressionPostIds));
    } catch (err: any) {
      logger.warn({ err: err?.message }, "Failed to record post impressions");
    }
  }

  // Generate signed view URLs (5 minutes) for post photos
  const admin = getStorageAdmin();
  const signedUrlMap = new Map<string, string>();
  const allPathsToSign = candidatePosts.flatMap((p) => (p.photoPaths as string[]) ?? []);
  if (admin && allPathsToSign.length > 0) {
    await Promise.all(
      allPathsToSign.map(async (path) => {
        try {
          const { data } = await admin.storage.from("post-photos").createSignedUrl(path, 300);
          if (data?.signedUrl) signedUrlMap.set(path, data.signedUrl);
        } catch {
          // ignore individual signed url failure
        }
      })
    );
  }

  const formattedPosts = candidatePosts.map((p) => {
    const isOwn = p.authorId === userId;
    const firstName = p.authorFullName?.trim().split(" ")[0] ?? "Member";
    const age = calculateAge(p.authorDateOfBirth);
    const location = p.authorCampusName || p.authorCity || null;
    const isVerified = Boolean(p.authorIsVerified || p.authorInstitutionVerified);
    const photoUrls = ((p.photoPaths as string[]) ?? [])
      .map((path) => signedUrlMap.get(path))
      .filter((u): u is string => Boolean(u));

    return {
      id: p.id,
      authorId: p.authorId,
      firstName,
      age,
      location,
      isVerified,
      text: p.text,
      photoUrls,
      createdAt: p.createdAt.toISOString(),
      isLiked: likedPostIds.has(p.id),
      isOwn,
      // Private likes: author sees count ONLY when > 0; viewers NEVER see any count
      likeCount: isOwn && p.likeCount > 0 ? p.likeCount : null,
    };
  });

  const nextCursor =
    candidatePosts.length === effectiveLimit
      ? candidatePosts[candidatePosts.length - 1].createdAt.toISOString()
      : null;

  res.json({
    posts: formattedPosts,
    nextCursor,
    totalImpressionsToday: totalImpressionsToday + newImpressionPostIds.length,
  });
});

// DELETE /posts/:postId — Delete own post
router.delete("/posts/:postId", requireAuth, async (req, res) => {
  if (!isFeedEnabled()) {
    res.status(404).json({ error: "not_found", code: "FEATURE_DISABLED", message: "Posts feed is disabled" });
    return;
  }

  const userId = (req as AuthedRequest).userId;
  const postId = String(req.params.postId);

  const [post] = await db
    .select()
    .from(postsTable)
    .where(and(eq(postsTable.id, postId), eq(postsTable.authorId, userId)))
    .limit(1);

  if (!post) {
    res.status(404).json({ error: "not_found", code: "POST_NOT_FOUND", message: "Post not found or unauthorized" });
    return;
  }

  // Remove photos from storage bucket
  const admin = getStorageAdmin();
  if (admin && post.photoPaths && post.photoPaths.length > 0) {
    try {
      await admin.storage.from("post-photos").remove(post.photoPaths as string[]);
    } catch (err: any) {
      logger.warn({ err: err?.message, postId }, "Failed to delete post photos from storage");
    }
  }

  await db.delete(postsTable).where(eq(postsTable.id, postId));

  res.json({ success: true });
});

// POST /posts/:postId/like — Toggle private like
router.post("/posts/:postId/like", requireAuth, async (req, res) => {
  if (!isFeedEnabled()) {
    res.status(404).json({ error: "not_found", code: "FEATURE_DISABLED", message: "Posts feed is disabled" });
    return;
  }

  const userId = (req as AuthedRequest).userId;
  const postId = String(req.params.postId);

  const [viewer] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);
  if (!viewer || !isMemberVerified(viewer)) {
    res.status(403).json({ error: "forbidden", code: "VIEWER_NOT_ELIGIBLE", message: "Active verified status required" });
    return;
  }

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
  if (!post) {
    res.status(404).json({ error: "not_found", code: "POST_NOT_FOUND", message: "Post not found" });
    return;
  }

  // Check if viewer already liked
  const [existingLike] = await db
    .select()
    .from(postLikesTable)
    .where(and(eq(postLikesTable.postId, postId), eq(postLikesTable.userId, userId)))
    .limit(1);

  if (existingLike) {
    // Toggle OFF: Remove like
    await db
      .delete(postLikesTable)
      .where(and(eq(postLikesTable.postId, postId), eq(postLikesTable.userId, userId)));

    // Decrement like count
    if (post.likeCount > 0) {
      await db
        .update(postsTable)
        .set({ likeCount: sql`GREATEST(0, ${postsTable.likeCount} - 1)` })
        .where(eq(postsTable.id, postId));
    }

    res.json({ liked: false });
    return;
  }

  // Rate limit: 50 likes per day
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dailyLikes = await db
    .select({ count: count() })
    .from(postLikesTable)
    .where(and(eq(postLikesTable.userId, userId), sql`${postLikesTable.createdAt} >= ${oneDayAgo}`));

  if ((dailyLikes[0]?.count ?? 0) >= 50) {
    res.status(429).json({ error: "rate_limited", code: "LIKE_RATE_LIMIT", message: "Daily like limit reached" });
    return;
  }

  // Insert like
  await db.insert(postLikesTable).values({ postId, userId });

  // Eligibility to increment counter:
  // 1. Account older than 7 days
  const viewerAgeMs = Date.now() - new Date(viewer.createdAt ?? 0).getTime();
  const isOlderThan7Days = viewerAgeMs >= 7 * 24 * 60 * 60 * 1000;

  // 2. Ignore likes from the author's invite chain (inviter, invitees, siblings invited by the same person)
  const [author] = await db.select().from(profilesTable).where(eq(profilesTable.id, post.authorId)).limit(1);

  let inInviteChain = false;
  if (author) {
    const isInviter = viewer.id === author.invitedByProfile;
    const isInvitee = author.id === viewer.invitedByProfile;
    const isSibling =
      Boolean(author.invitedByProfile && viewer.invitedByProfile) &&
      author.invitedByProfile === viewer.invitedByProfile;
    inInviteChain = isInviter || isInvitee || isSibling;
  }

  if (isOlderThan7Days && !inInviteChain) {
    await db
      .update(postsTable)
      .set({ likeCount: sql`${postsTable.likeCount} + 1` })
      .where(eq(postsTable.id, postId));
  }

  res.json({ liked: true });
});

// POST /posts/:postId/hide-author — Hide all posts from this author
router.post("/posts/:postId/hide-author", requireAuth, async (req, res) => {
  if (!isFeedEnabled()) {
    res.status(404).json({ error: "not_found", code: "FEATURE_DISABLED", message: "Posts feed is disabled" });
    return;
  }

  const userId = (req as AuthedRequest).userId;
  const postId = String(req.params.postId);

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
  if (!post) {
    res.status(404).json({ error: "not_found", code: "POST_NOT_FOUND", message: "Post not found" });
    return;
  }

  await db
    .insert(postHidesTable)
    .values({ userId, authorId: post.authorId })
    .onConflictDoNothing();

  res.json({ hidden: true });
});

// POST /posts/:postId/report — Report post and preserve evidence
router.post("/posts/:postId/report", requireAuth, async (req, res) => {
  if (!isFeedEnabled()) {
    res.status(404).json({ error: "not_found", code: "FEATURE_DISABLED", message: "Posts feed is disabled" });
    return;
  }

  const userId = (req as AuthedRequest).userId;
  const postId = String(req.params.postId);
  const { reason, details } = req.body as { reason?: string; details?: string };

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
  if (!post) {
    res.status(404).json({ error: "not_found", code: "POST_NOT_FOUND", message: "Post not found" });
    return;
  }

  const reportReason = reason && typeof reason === "string" ? reason : "post";

  // Evidence preservation in private 'report-evidence' storage bucket
  const admin = getStorageAdmin();
  if (admin) {
    try {
      const evidenceData = {
        postId: post.id,
        authorId: post.authorId,
        text: post.text,
        photoPaths: post.photoPaths,
        reporterId: userId,
        reason: reportReason,
        details: details ?? null,
        reportedAt: new Date().toISOString(),
      };

      const evidenceJsonPath = `evidence/${postId}/${randomUUID()}.json`;
      await admin.storage
        .from("report-evidence")
        .upload(evidenceJsonPath, Buffer.from(JSON.stringify(evidenceData, null, 2)), {
          contentType: "application/json",
          upsert: true,
        });

      // Copy photos to evidence bucket so they survive post deletion
      if (post.photoPaths && post.photoPaths.length > 0) {
        for (const p of post.photoPaths as string[]) {
          const { data: blob } = await admin.storage.from("post-photos").download(p);
          if (blob) {
            const buf = Buffer.from(await blob.arrayBuffer());
            const fileName = p.split("/").pop();
            await admin.storage
              .from("report-evidence")
              .upload(`evidence/${postId}/${fileName}`, buf, {
                contentType: "image/jpeg",
                upsert: true,
              });
          }
        }
      }
    } catch (err: any) {
      logger.warn({ err: err?.message, postId }, "Evidence backup to report-evidence bucket failed");
    }
  }

  // Insert report row
  await db.insert(reportsTable).values({
    reporterId: userId,
    reportedId: post.authorId,
    postId: post.id,
    reason: reportReason,
    details: details ?? "Post reported by member",
    status: "pending",
  });

  // Check 3 distinct verified reports threshold
  const postReports = await db
    .select({
      reporterId: reportsTable.reporterId,
      isVerified: profilesTable.isVerified,
      institutionVerified: profilesTable.institutionVerified,
    })
    .from(reportsTable)
    .innerJoin(profilesTable, eq(reportsTable.reporterId, profilesTable.id))
    .where(eq(reportsTable.postId, postId));

  const verifiedReporters = new Set(
    postReports
      .filter((r) => r.isVerified || r.institutionVerified)
      .map((r) => r.reporterId)
  );

  if (verifiedReporters.size >= 3) {
    await db.update(postsTable).set({ hidden: true }).where(eq(postsTable.id, postId));
    logger.info({ postId }, "Post hidden automatically after 3 verified reports");
  }

  res.json({ reported: true });
});

export default router;
