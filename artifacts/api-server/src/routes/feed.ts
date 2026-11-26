import { Router } from "express";
import { eq, and, or, ne, desc, asc, inArray, sql } from "drizzle-orm";
import {
  db,
  postsTable,
  postLikesTable,
  profilesTable,
  profilePhotosTable,
  interestsTable,
  matchesTable,
} from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";
import { getStorageAdmin } from "../lib/storage.js";

const router = Router();

function calculateAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function formatShortName(fullName: string | null | undefined): string {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Member";
  const first = parts[0].length > 12 ? `${parts[0].slice(0, 11)}…` : parts[0];
  if (parts.length === 1) return first;
  return `${first} ${parts[1][0]}.`;
}

// GET /api/feed
router.get("/feed", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 30);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const admin = getStorageAdmin();

  const postRows = await db
    .select({
      postId: postsTable.id,
      userId: postsTable.authorId,
      caption: postsTable.text,
      photoPaths: postsTable.photoPaths,
      likesCount: postsTable.likeCount,
      createdAt: postsTable.createdAt,
      fullName: profilesTable.fullName,
      dateOfBirth: profilesTable.dateOfBirth,
      isVerified: profilesTable.isVerified,
      institutionVerified: profilesTable.institutionVerified,
      campusName: profilesTable.campusName,
      city: profilesTable.city,
      district: profilesTable.district,
      primaryIntent: profilesTable.primaryIntent,
      tags: profilesTable.tags,
      bio: profilesTable.bio,
    })
    .from(postsTable)
    .innerJoin(profilesTable, eq(postsTable.authorId, profilesTable.id))
    .where(
      and(
        eq(postsTable.hidden, false),
        eq(profilesTable.accountStatus, "active"),
        ne(postsTable.authorId, userId),
      ),
    )
    .orderBy(desc(postsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const userIdsFromPosts = Array.from(new Set(postRows.map((p) => p.userId)));
  const avatarRows =
    userIdsFromPosts.length > 0
      ? await db
          .select()
          .from(profilePhotosTable)
          .where(inArray(profilePhotosTable.userId, userIdsFromPosts))
          .orderBy(desc(profilePhotosTable.isPrimary), asc(profilePhotosTable.sortOrder))
      : [];

  const avatarMap = new Map<string, string>();
  for (const a of avatarRows) {
    if (avatarMap.has(a.userId)) continue;
    if (admin && a.storagePath) {
      try {
        const { data } = await admin.storage.from("profile-photos").createSignedUrl(a.storagePath, 300);
        if (data?.signedUrl) {
          avatarMap.set(a.userId, data.signedUrl);
          continue;
        }
      } catch {}
    }
    if (a.publicUrl) avatarMap.set(a.userId, a.publicUrl);
  }

  const myLikedPostIds = new Set<string>();
  if (postRows.length > 0) {
    const likes = await db
      .select({ postId: postLikesTable.postId })
      .from(postLikesTable)
      .where(
        and(
          eq(postLikesTable.userId, userId),
          inArray(postLikesTable.postId, postRows.map((p) => p.postId)),
        ),
      );
    for (const l of likes) myLikedPostIds.add(l.postId);
  }

  const feedPosts: any[] = [];
  for (const r of postRows) {
    const paths = Array.isArray(r.photoPaths) ? (r.photoPaths as string[]) : [];
    let photoUrl: string | null = null;
    if (paths[0] && admin) {
      try {
        const { data } = await admin.storage.from("post-photos").createSignedUrl(paths[0], 300);
        if (data?.signedUrl) photoUrl = data.signedUrl;
      } catch {}
    }
    if (!photoUrl) photoUrl = avatarMap.get(r.userId) ?? null;
    if (!photoUrl) continue;

    feedPosts.push({
      postId: r.postId,
      photoUrl,
      caption: r.caption || r.bio || "",
      locationName: r.district || r.city || "Kigali",
      likesCount: r.likesCount ?? 0,
      createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
      hasLiked: myLikedPostIds.has(r.postId),
      user: {
        id: r.userId,
        displayName: formatShortName(r.fullName),
        age: calculateAge(r.dateOfBirth),
        avatarUrl: avatarMap.get(r.userId) ?? photoUrl,
        isVerified: Boolean(r.isVerified || r.institutionVerified),
        campus: r.campusName ?? null,
        neighborhood: r.district || r.city || "Kigali",
        primaryIntent: r.primaryIntent ?? "serious",
        tags: Array.isArray(r.tags) ? r.tags : [],
      },
    });
  }

  // Supplement with active verified Rwanda profiles that have primary photos
  if (feedPosts.length < limit) {
    const needed = limit - feedPosts.length;
    const excludeIds = [userId, ...feedPosts.map((f) => f.user.id)];
    const profileRows = await db
      .select()
      .from(profilesTable)
      .where(
        and(
          eq(profilesTable.accountStatus, "active"),
          ne(profilesTable.profilePaused, true),
          ...excludeIds.map((eid) => ne(profilesTable.id, eid)),
        ),
      )
      .orderBy(desc(profilesTable.lastActive))
      .limit(needed);

    const pIds = profileRows.map((p) => p.id);
    const pPhotos =
      pIds.length > 0
        ? await db
            .select()
            .from(profilePhotosTable)
            .where(inArray(profilePhotosTable.userId, pIds))
            .orderBy(desc(profilePhotosTable.isPrimary), asc(profilePhotosTable.sortOrder))
        : [];
    const pPhotoMap = new Map<string, string>();
    for (const ph of pPhotos) {
      if (pPhotoMap.has(ph.userId)) continue;
      if (admin && ph.storagePath) {
        try {
          const { data } = await admin.storage.from("profile-photos").createSignedUrl(ph.storagePath, 300);
          if (data?.signedUrl) {
            pPhotoMap.set(ph.userId, data.signedUrl);
            continue;
          }
        } catch {}
      }
      if (ph.publicUrl) pPhotoMap.set(ph.userId, ph.publicUrl);
    }

    const myInterests =
      pIds.length > 0
        ? await db
            .select({ toUser: interestsTable.toUser })
            .from(interestsTable)
            .where(and(eq(interestsTable.fromUser, userId), inArray(interestsTable.toUser, pIds)))
        : [];
    const likedUsersSet = new Set(myInterests.map((i) => i.toUser));

    for (const p of profileRows) {
      const photoUrl = pPhotoMap.get(p.id);
      if (!photoUrl) continue;
      feedPosts.push({
        postId: `profile_${p.id}`,
        photoUrl,
        caption: p.bio || "",
        locationName: p.district || p.city || "Kigali",
        likesCount: p.vouchCount ?? 0,
        createdAt: p.lastActive?.toISOString() ?? p.createdAt?.toISOString() ?? new Date().toISOString(),
        hasLiked: likedUsersSet.has(p.id),
        user: {
          id: p.id,
          displayName: formatShortName(p.fullName),
          age: calculateAge(p.dateOfBirth),
          avatarUrl: photoUrl,
          isVerified: Boolean(p.isVerified || p.institutionVerified),
          campus: p.campusName ?? null,
          neighborhood: p.district || p.city || "Kigali",
          primaryIntent: p.primaryIntent ?? "serious",
          tags: Array.isArray(p.tags) ? p.tags : [],
        },
      });
    }
  }

  res.json({
    posts: feedPosts,
    hasMore: feedPosts.length >= limit,
  });
});

// POST /api/feed/like
router.post("/feed/like", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { postId, targetUserId } = req.body as { postId?: string; targetUserId?: string };

  if (!targetUserId || targetUserId === userId) {
    res.status(400).json({ error: "bad_request", message: "Valid targetUserId is required" });
    return;
  }

  if (postId && !postId.startsWith("profile_")) {
    try {
      const existingLike = await db
        .select({ postId: postLikesTable.postId })
        .from(postLikesTable)
        .where(and(eq(postLikesTable.postId, postId), eq(postLikesTable.userId, userId)))
        .limit(1);

      if (existingLike.length === 0) {
        await db.insert(postLikesTable).values({ postId, userId });
        await db
          .update(postsTable)
          .set({ likeCount: sql`${postsTable.likeCount} + 1` })
          .where(eq(postsTable.id, postId));
      }
    } catch {}
  }

  const existingInterest = await db
    .select({ id: interestsTable.id })
    .from(interestsTable)
    .where(and(eq(interestsTable.fromUser, userId), eq(interestsTable.toUser, targetUserId)))
    .limit(1);

  if (existingInterest.length === 0) {
    await db.insert(interestsTable).values({
      fromUser: userId,
      toUser: targetUserId,
      reactionType: "campus",
      isGoldenBid: false,
    });
  }

  // Check reciprocal interest (via interestsTable or postLikesTable on caller's posts)
  const mutualInterest = await db
    .select({ id: interestsTable.id })
    .from(interestsTable)
    .where(and(eq(interestsTable.fromUser, targetUserId), eq(interestsTable.toUser, userId)))
    .limit(1);

  let isMutual = mutualInterest.length > 0;
  if (!isMutual) {
    const mutualPostLike = await db
      .select({ postId: postLikesTable.postId })
      .from(postLikesTable)
      .innerJoin(postsTable, eq(postLikesTable.postId, postsTable.id))
      .where(and(eq(postLikesTable.userId, targetUserId), eq(postsTable.authorId, userId)))
      .limit(1);
    isMutual = mutualPostLike.length > 0;
  }

  if (!isMutual) {
    res.json({ isMatch: false, matchId: null });
    return;
  }

  const existingMatch = await db
    .select({ id: matchesTable.id })
    .from(matchesTable)
    .where(
      or(
        and(eq(matchesTable.userA, userId), eq(matchesTable.userB, targetUserId)),
        and(eq(matchesTable.userA, targetUserId), eq(matchesTable.userB, userId)),
      ),
    )
    .limit(1);

  let matchId = existingMatch[0]?.id ?? null;
  if (!matchId) {
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const assignedFirstUser = Math.random() > 0.5 ? userId : targetUserId;
    const [created] = await db
      .insert(matchesTable)
      .values({
        userA: userId,
        userB: targetUserId,
        assignedFirstUser,
        expiresAt,
      })
      .returning({ id: matchesTable.id });
    matchId = created?.id ?? null;
  }

  const [partner] = await db
    .select({ id: profilesTable.id, fullName: profilesTable.fullName })
    .from(profilesTable)
    .where(eq(profilesTable.id, targetUserId))
    .limit(1);

  res.json({
    isMatch: true,
    matchId,
    partnerProfile: partner
      ? { id: partner.id, displayName: formatShortName(partner.fullName) }
      : null,
  });
});

export default router;
