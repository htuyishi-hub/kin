import { Router } from "express";
import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
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

// GET /stories — Active 24h stories grouped by user
router.get("/stories", requireAuth, async (_req, res) => {
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
      displayName: string;
      avatarUrl: string | null;
      isVerified: boolean;
      facultyFlair: string | null;
      stories: Array<{
        id: string;
        mediaUrl: string;
        caption: string | null;
        locationName: string | null;
        createdAt: string;
      }>;
    }
  >();

  for (const r of rows) {
    if (!grouped.has(r.userId)) {
      grouped.set(r.userId, {
        userId: r.userId,
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
    res.status(400).json({ error: "media_required" });
    return;
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const [created] = await db
    .insert(storiesTable)
    .values({
      userId,
      mediaUrl: resolvedUrl,
      caption: caption?.trim().slice(0, 140) || null,
      locationName: locationName?.trim().slice(0, 80) || null,
      expiresAt,
    })
    .returning();

  res.json({ success: true, story: created });
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
