import { Router } from "express";
import { asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import {
  db,
  profilesTable,
  profilePhotosTable,
  storiesTable,
  photoCommentsTable,
  paymentsTable,
} from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";

const router = Router();

// GET /stories — Active 24h stories grouped by user (with isOwn and viewsCount)
router.get("/stories", requireAuth, async (req, res) => {
  const callerId = (req as AuthedRequest).userId;
  const now = new Date();
  const rows = await db
    .select({
      id: storiesTable.id,
      userId: storiesTable.userId,
      mediaUrl: storiesTable.mediaUrl,
      caption: storiesTable.caption,
      locationName: storiesTable.locationName,
      createdAt: storiesTable.createdAt,
      expiresAt: storiesTable.expiresAt,
      fullName: profilesTable.fullName,
      isVerified: profilesTable.isVerified,
      verificationStatus: profilesTable.verificationStatus,
      facultyFlair: profilesTable.facultyFlair,
    })
    .from(storiesTable)
    .innerJoin(profilesTable, eq(storiesTable.userId, profilesTable.id))
    .where(gt(storiesTable.expiresAt, now))
    .orderBy(desc(storiesTable.createdAt))
    .limit(60);

  const storyIds = rows.map((r) => r.id);
  const viewCountMap = new Map<string, number>();
  if (storyIds.length > 0) {
    try {
      const vcRes: any = await db.execute(
        sql`SELECT story_id, COUNT(*)::int AS cnt FROM story_views WHERE story_id = ANY(${storyIds}::uuid[]) GROUP BY story_id`,
      );
      for (const vr of vcRes?.rows ?? []) {
        viewCountMap.set(String(vr.story_id), Number(vr.cnt) || 0);
      }
    } catch {}
  }

  const userIds = Array.from(new Set(rows.map((r) => r.userId)));
  const photos = userIds.length
    ? await db
        .select({
          userId: profilePhotosTable.userId,
          publicUrl: profilePhotosTable.publicUrl,
          storagePath: profilePhotosTable.storagePath,
        })
        .from(profilePhotosTable)
        .where(inArray(profilePhotosTable.userId, userIds))
        .orderBy(asc(profilePhotosTable.sortOrder))
    : [];

  const avatarMap = new Map<string, string>();
  for (const ph of photos) {
    if (!avatarMap.has(ph.userId)) {
      const url = ph.publicUrl || ph.storagePath;
      if (url) avatarMap.set(ph.userId, url);
    }
  }

  const grouped = new Map<
    string,
    {
      userId: string;
      isOwn: boolean;
      displayName: string;
      avatarUrl: string | null;
      isVerified: boolean;
      facultyFlair: string | null;
      stories: Array<{
        id: string;
        mediaUrl: string;
        caption: string | null;
        locationName: string | null;
        viewsCount: number;
        createdAt: string;
      }>;
    }
  >();

  for (const r of rows) {
    if (!grouped.has(r.userId)) {
      grouped.set(r.userId, {
        userId: r.userId,
        isOwn: r.userId === callerId,
        displayName: r.fullName?.trim().split(" ")[0] ?? "kinn Member",
        avatarUrl: avatarMap.get(r.userId) ?? r.mediaUrl,
        isVerified: Boolean(r.isVerified || r.verificationStatus === "verified"),
        facultyFlair: r.facultyFlair ?? null,
        stories: [],
      });
    }
    grouped.get(r.userId)!.stories.push({
      id: r.id,
      mediaUrl: r.mediaUrl,
      caption: r.caption ?? null,
      locationName: r.locationName ?? null,
      viewsCount: viewCountMap.get(r.id) ?? 0,
      createdAt: r.createdAt.toISOString(),
    });
  }

  res.json(Array.from(grouped.values()));
});

// POST /stories — Post a 24h ephemeral story
router.post("/stories", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { mediaUrl, caption, locationName } = req.body as {
    mediaUrl?: string;
    caption?: string;
    locationName?: string;
  };

  let resolvedUrl = mediaUrl?.trim();
  if (!resolvedUrl) {
    const [ph] = await db
      .select({ publicUrl: profilePhotosTable.publicUrl, storagePath: profilePhotosTable.storagePath })
      .from(profilePhotosTable)
      .where(eq(profilePhotosTable.userId, userId))
      .orderBy(asc(profilePhotosTable.sortOrder))
      .limit(1);
    resolvedUrl = ph?.publicUrl || ph?.storagePath || "";
  }

  if (!resolvedUrl) {
    res.status(400).json({ error: "photo_required" });
    return;
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const [created] = await db
    .insert(storiesTable)
    .values({
      userId,
      mediaUrl: resolvedUrl,
      caption: caption?.trim().slice(0, 140) || null,
      locationName: locationName?.trim().slice(0, 60) || "Kigali",
      expiresAt,
    })
    .returning();

  res.status(201).json(created);
});

// POST /stories/:id/view — Record story view
router.post("/stories/:id/view", requireAuth, async (req, res) => {
  const viewerId = (req as AuthedRequest).userId;
  const storyId = String(req.params["id"] ?? "");
  try {
    await db.execute(
      sql`INSERT INTO story_views (story_id, viewer_id) VALUES (${storyId}::uuid, ${viewerId}::uuid) ON CONFLICT (story_id, viewer_id) DO NOTHING`,
    );
  } catch {}
  res.json({ recorded: true });
});

// GET /stories/:id/viewers — List viewers for story owner ("Who Viewed My Story")
router.get("/stories/:id/viewers", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const storyId = String(req.params["id"] ?? "");

  const [story] = await db
    .select({ userId: storiesTable.userId })
    .from(storiesTable)
    .where(eq(storiesTable.id, storyId))
    .limit(1);

  if (!story || story.userId !== userId) {
    res.json({ viewers: [] });
    return;
  }

  const rowsRes: any = await db.execute(
    sql`
      SELECT sv.viewer_id, sv.viewed_at, p.full_name, p.campus_name, p.is_verified,
             (SELECT COALESCE(pp.public_url, pp.storage_path) FROM profile_photos pp WHERE pp.user_id = p.id ORDER BY pp.is_primary DESC, pp.sort_order ASC LIMIT 1) AS avatar_url
      FROM story_views sv
      INNER JOIN profiles p ON sv.viewer_id = p.id
      WHERE sv.story_id = ${storyId}::uuid AND sv.viewer_id <> ${userId}::uuid
      ORDER BY sv.viewed_at DESC
      LIMIT 50
    `,
  );

  const viewers = (rowsRes?.rows ?? []).map((r: any) => ({
    id: r.viewer_id,
    displayName: r.full_name ? String(r.full_name).trim().split(" ")[0] : "Member",
    avatarUrl: r.avatar_url ?? null,
    campus: r.campus_name ?? null,
    isVerified: Boolean(r.is_verified),
    viewedAt: r.viewed_at ? new Date(r.viewed_at).toISOString() : new Date().toISOString(),
  }));

  res.json({ viewers });
});

// POST /stories/:id/highlight — Pin story into permanent Highlight Album
router.post("/stories/:id/highlight", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const storyId = String(req.params["id"] ?? "");
  const category = String((req.body as any)?.category || "Cafes").trim().slice(0, 40);

  await db.execute(
    sql`UPDATE stories SET is_highlight = TRUE, highlight_category = ${category} WHERE id = ${storyId}::uuid AND user_id = ${userId}::uuid`,
  );

  res.json({ highlighted: true, category });
});

// GET /stories/highlights — Get permanent Highlight Albums for user
router.get("/stories/highlights", requireAuth, async (req, res) => {
  const callerId = (req as AuthedRequest).userId;
  const targetUserId = typeof req.query.userId === "string" && req.query.userId ? req.query.userId : callerId;

  const rowsRes: any = await db.execute(
    sql`
      SELECT id, media_url, caption, location_name, highlight_category, created_at
      FROM stories
      WHERE user_id = ${targetUserId}::uuid AND is_highlight = TRUE
      ORDER BY created_at DESC
      LIMIT 30
    `,
  );

  const albumsMap = new Map<string, any[]>();
  for (const r of rowsRes?.rows ?? []) {
    const cat = r.highlight_category || "Highlights";
    const list = albumsMap.get(cat) ?? [];
    list.push({
      id: r.id,
      mediaUrl: r.media_url,
      caption: r.caption ?? null,
      locationName: r.location_name ?? null,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    });
    albumsMap.set(cat, list);
  }

  const albums = Array.from(albumsMap.entries()).map(([category, items]) => ({
    category,
    coverUrl: items[0]?.mediaUrl ?? null,
    items,
  }));

  res.json({ albums });
});

// POST /stories/:id/reply — Reply to a story with optional 100 RWF Rose
router.post("/stories/:id/reply", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const storyId = String(req.params["id"] ?? "");
  const { messageText, giftType } = req.body as {
    messageText?: string;
    giftType?: "rose" | "none";
  };

  const [story] = await db
    .select()
    .from(storiesTable)
    .where(eq(storiesTable.id, storyId))
    .limit(1);

  if (!story) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  const isRose = giftType === "rose";
  if (isRose) {
    await db.insert(paymentsTable).values({
      userId,
      productType: "story_rose",
      amountRwf: 100,
      status: "completed",
      fulfilled: true,
      completedAt: new Date(),
    });
  }

  await db.insert(photoCommentsTable).values({
    senderId: userId,
    targetProfileId: story.userId,
    photoUrl: story.mediaUrl,
    commentText: (messageText?.trim() || (isRose ? "🌹 Sent a Rose on your story!" : "🔥")).slice(0, 140),
    giftType: isRose ? "rose" : "comment",
    amountRwf: isRose ? 100 : 0,
  } as any);

  res.json({ success: true, giftType: isRose ? "rose" : "none" });
});

export default router;
