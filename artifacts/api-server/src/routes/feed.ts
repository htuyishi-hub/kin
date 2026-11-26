import { Router } from "express";
import { eq, and, or, ne, desc, asc, inArray, sql } from "drizzle-orm";
import {
  db,
  postsTable,
  postLikesTable,
  postImpressionsTable,
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

// Terms & Policy Shield: reject commercial ads, external links, phone numbers, social handles
function violatesLifestylePolicy(text: string): boolean {
  if (!text) return false;
  const phonePattern = /(?:\+?250[\s.-]*)?0?7[2389][\s.-]*(?:\d[\s.-]*){7}/;
  const genericDigitsPattern = /(?:\d[\s.-]*){9,}/;
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const urlPattern = /(?:https?:\/\/|www\.|\b\S+\.(?:com|rw|org|net|io|me|app|info|co|xyz)\b)/i;
  const handlePattern = /@[\w.]{2,}/;
  const adSpamPattern = /\b(?:whatsapp|telegram|instagram|insta|snapchat|tiktok|facebook|buy now|for sale|discount|promo|order now|dm for price|delivery available)\b/i;

  return (
    phonePattern.test(text) ||
    genericDigitsPattern.test(text) ||
    emailPattern.test(text) ||
    urlPattern.test(text) ||
    handlePattern.test(text) ||
    adSpamPattern.test(text)
  );
}

// GET /api/feed
router.get("/feed", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 30);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const locationFilter = typeof req.query.location === "string" ? req.query.location.trim().toLowerCase() : "";

  const admin = getStorageAdmin();

  const postRows = await db
    .select({
      postId: postsTable.id,
      userId: postsTable.authorId,
      caption: postsTable.text,
      photoPaths: postsTable.photoPaths,
      likesCount: postsTable.likeCount,
      viewsCount: postsTable.impressions,
      locationName: sql<string | null>`${postsTable}.location_name`,
      postTags: sql<string[] | null>`${postsTable}.tags`,
      musicTitle: sql<string | null>`${postsTable}.music_title`,
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
    .limit(limit * 2)
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
  const userGalleryMap = new Map<string, string[]>();
  for (const a of avatarRows) {
    let signed: string | null = null;
    if (admin && a.storagePath) {
      try {
        const { data } = await admin.storage.from("profile-photos").createSignedUrl(a.storagePath, 300);
        if (data?.signedUrl) signed = data.signedUrl;
      } catch {}
    }
    if (!signed && a.publicUrl) signed = a.publicUrl;
    if (!signed) continue;

    if (!avatarMap.has(a.userId)) avatarMap.set(a.userId, signed);
    const list = userGalleryMap.get(a.userId) ?? [];
    if (list.length < 5) {
      list.push(signed);
      userGalleryMap.set(a.userId, list);
    }
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
  const viewedRealPostIds: string[] = [];

  for (const r of postRows) {
    const loc = r.locationName || r.district || r.city || "Kigali";
    if (locationFilter && !loc.toLowerCase().includes(locationFilter)) continue;

    const paths = Array.isArray(r.photoPaths) ? (r.photoPaths as string[]).slice(0, 5) : [];
    const photoUrls: string[] = [];
    for (const pPath of paths) {
      if (pPath.startsWith("http://") || pPath.startsWith("https://")) {
        photoUrls.push(pPath);
        continue;
      }
      if (admin) {
        try {
          const { data } = await admin.storage.from("post-photos").createSignedUrl(pPath, 300);
          if (data?.signedUrl) {
            photoUrls.push(data.signedUrl);
            continue;
          }
        } catch {}
      }
    }
    if (photoUrls.length === 0) {
      const av = avatarMap.get(r.userId);
      if (av) photoUrls.push(av);
    }
    if (photoUrls.length === 0) continue;

    viewedRealPostIds.push(r.postId);
    const mergedTags = Array.isArray(r.postTags) && r.postTags.length > 0
      ? r.postTags
      : Array.isArray(r.tags)
      ? r.tags
      : [];

    feedPosts.push({
      postId: r.postId,
      photoUrl: photoUrls[0],
      photoUrls,
      caption: r.caption || r.bio || "",
      locationName: loc,
      musicTitle: r.musicTitle ?? null,
      likesCount: r.likesCount ?? 0,
      viewsCount: (r.viewsCount ?? 0) + 1,
      createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
      hasLiked: myLikedPostIds.has(r.postId),
      user: {
        id: r.userId,
        displayName: formatShortName(r.fullName),
        age: calculateAge(r.dateOfBirth),
        avatarUrl: avatarMap.get(r.userId) ?? photoUrls[0],
        isVerified: Boolean(r.isVerified || r.institutionVerified),
        campus: r.campusName ?? null,
        neighborhood: loc,
        primaryIntent: r.primaryIntent ?? "serious",
        tags: mergedTags,
      },
    });
    if (feedPosts.length >= limit) break;
  }

  // Record views asynchronously for real posts
  if (viewedRealPostIds.length > 0) {
    Promise.all(
      viewedRealPostIds.map((pid) =>
        db
          .insert(postImpressionsTable)
          .values({ postId: pid, viewerId: userId })
          .onConflictDoNothing()
          .then((resImp: any) => {
            if ((resImp?.rowCount ?? 0) > 0) {
              return db
                .update(postsTable)
                .set({ impressions: sql`${postsTable.impressions} + 1` })
                .where(eq(postsTable.id, pid));
            }
            return null;
          })
          .catch(() => {}),
      ),
    ).catch(() => {});
  }

  // Supplement with active verified Rwanda profiles (up to 5 photos each as carousel)
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
      .limit(needed * 2);

    const pIds = profileRows.map((p) => p.id);
    const pPhotos =
      pIds.length > 0
        ? await db
            .select()
            .from(profilePhotosTable)
            .where(inArray(profilePhotosTable.userId, pIds))
            .orderBy(desc(profilePhotosTable.isPrimary), asc(profilePhotosTable.sortOrder))
        : [];
    const pGalleryMap = new Map<string, string[]>();
    for (const ph of pPhotos) {
      let url: string | null = null;
      if (admin && ph.storagePath) {
        try {
          const { data } = await admin.storage.from("profile-photos").createSignedUrl(ph.storagePath, 300);
          if (data?.signedUrl) url = data.signedUrl;
        } catch {}
      }
      if (!url && ph.publicUrl) url = ph.publicUrl;
      if (!url) continue;
      const arr = pGalleryMap.get(ph.userId) ?? [];
      if (arr.length < 5) {
        arr.push(url);
        pGalleryMap.set(ph.userId, arr);
      }
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
      const loc = p.district || p.city || "Kigali";
      if (locationFilter && !loc.toLowerCase().includes(locationFilter)) continue;

      const photoUrls = pGalleryMap.get(p.id) ?? [];
      if (photoUrls.length === 0) continue;

      feedPosts.push({
        postId: `profile_${p.id}`,
        photoUrl: photoUrls[0],
        photoUrls,
        caption: p.bio || "",
        locationName: loc,
        likesCount: p.vouchCount ?? 0,
        viewsCount: Math.max((p.vouchCount ?? 0) * 7 + 12, 12),
        createdAt: p.lastActive?.toISOString() ?? p.createdAt?.toISOString() ?? new Date().toISOString(),
        hasLiked: likedUsersSet.has(p.id),
        user: {
          id: p.id,
          displayName: formatShortName(p.fullName),
          age: calculateAge(p.dateOfBirth),
          avatarUrl: photoUrls[0],
          isVerified: Boolean(p.isVerified || p.institutionVerified),
          campus: p.campusName ?? null,
          neighborhood: loc,
          primaryIntent: p.primaryIntent ?? "serious",
          tags: Array.isArray(p.tags) ? p.tags : [],
        },
      });
      if (feedPosts.length >= limit) break;
    }
  }

  res.json({
    posts: feedPosts,
    hasMore: feedPosts.length >= limit,
  });
});

// POST /api/feed/posts — Create 1-5 photo lifestyle post (Purity & Terms Policy enforced)
router.post("/feed/posts", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { photoUrls, caption, locationName, tags, musicTitle } = req.body as {
    photoUrls?: string[];
    caption?: string;
    locationName?: string;
    tags?: string[];
    musicTitle?: string;
  };

  const cleanCaption = (caption || "").trim();
  const cleanPhotos = Array.isArray(photoUrls)
    ? photoUrls.filter((u) => typeof u === "string" && u.trim().length > 0).slice(0, 5)
    : [];

  if (cleanPhotos.length === 0) {
    res.status(400).json({ error: "bad_request", message: "At least 1 photo is required (up to 5)" });
    return;
  }

  if (!cleanCaption || cleanCaption.length > 200) {
    res.status(400).json({ error: "bad_request", message: "Caption must be between 1 and 200 characters" });
    return;
  }

  if (violatesLifestylePolicy(cleanCaption) || violatesLifestylePolicy(locationName || "")) {
    res.status(400).json({
      error: "policy_violation",
      message: "Commercial ads, external links, or phone numbers are not allowed",
    });
    return;
  }

  const cleanLocation = (locationName || "Kigali").trim().slice(0, 80) || "Kigali";
  const cleanTags = Array.isArray(tags)
    ? tags.map((t) => String(t).replace(/^#/, "").trim()).filter(Boolean).slice(0, 6)
    : [];
  const cleanMusic = musicTitle ? String(musicTitle).trim().slice(0, 80) : null;

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [created] = await db
    .insert(postsTable)
    .values({
      authorId: userId,
      text: cleanCaption,
      photoPaths: cleanPhotos,
      expiresAt,
      hidden: false,
      likeCount: 0,
      impressions: 1,
    })
    .returning();

  if (created?.id) {
    await db.execute(
      sql`UPDATE posts SET location_name = ${cleanLocation}, tags = ${cleanTags}, music_title = ${cleanMusic} WHERE id = ${created.id}`,
    );
  }

  res.status(201).json({
    postId: created?.id,
    photoUrls: cleanPhotos,
    caption: cleanCaption,
    locationName: cleanLocation,
    tags: cleanTags,
    musicTitle: cleanMusic,
    viewsCount: 1,
  });
});

// POST /api/feed/view — Track post view
router.post("/feed/view", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { postId } = req.body as { postId?: string };

  if (!postId || postId.startsWith("profile_")) {
    res.json({ recorded: false });
    return;
  }

  try {
    const ins: any = await db
      .insert(postImpressionsTable)
      .values({ postId, viewerId: userId })
      .onConflictDoNothing();
    if ((ins?.rowCount ?? 0) > 0) {
      await db
        .update(postsTable)
        .set({ impressions: sql`${postsTable.impressions} + 1` })
        .where(eq(postsTable.id, postId));
    }
    res.json({ recorded: true });
  } catch {
    res.json({ recorded: false });
  }
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
