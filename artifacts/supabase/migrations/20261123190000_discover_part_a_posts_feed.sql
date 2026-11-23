-- =============================================================================
-- KIN DATING PLATFORM: DISCOVER FEATURES (PART A: POSTS FEED)
-- Migration: 20261123190000_discover_part_a_posts_feed.sql
-- Description: Schema for members-only posts feed, likes, hides, impressions,
--              report-evidence storage buckets, and admin analytics view.
-- DO NOT RUN LIVE - Migration file only.
-- =============================================================================

-- 1. STORAGE BUCKETS (post-photos and report-evidence)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-photos',
  'post-photos',
  false,
  524288, -- 500 KB limit per photo
  ARRAY['image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 524288,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg'];

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'report-evidence',
  'report-evidence',
  false,
  5242880 -- 5 MB limit
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880;

-- 2. CREATE POSTS TABLE
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text VARCHAR(200) NOT NULL,
  photo_paths TEXT[] DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days') NOT NULL,
  hidden BOOLEAN DEFAULT FALSE NOT NULL,
  like_count INTEGER DEFAULT 0 NOT NULL,
  impressions INTEGER DEFAULT 0 NOT NULL
);

-- 3. CREATE POST_LIKES TABLE
CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

-- 4. CREATE POST_HIDES TABLE (Viewer can hide all posts from one author)
CREATE TABLE IF NOT EXISTS public.post_hides (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, author_id)
);

-- 5. CREATE POST_IMPRESSIONS TABLE (Track distinct viewers and caps)
CREATE TABLE IF NOT EXISTS public.post_impressions (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (post_id, viewer_id)
);

-- 6. ALTER REPORTS TABLE (Add post_id reference if not exists)
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL;

-- 7. INDEXES FOR HIGH-THROUGHPUT FEED QUERIES
CREATE INDEX IF NOT EXISTS idx_posts_author_created ON public.posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_active_feed ON public.posts(hidden, expires_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_created ON public.post_likes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_impressions_viewer_created ON public.post_impressions(viewer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_hides_user_author ON public.post_hides(user_id, author_id);
CREATE INDEX IF NOT EXISTS idx_reports_post_id ON public.reports(post_id);

-- 8. SECURITY: ENABLE RLS AND REVOKE CLIENT ACCESS (NO CLIENT GRANTS)
-- All reads and writes must pass through the API server via service role.
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_hides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_impressions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.posts FROM anon, authenticated;
REVOKE ALL ON TABLE public.post_likes FROM anon, authenticated;
REVOKE ALL ON TABLE public.post_hides FROM anon, authenticated;
REVOKE ALL ON TABLE public.post_impressions FROM anon, authenticated;

-- 9. ADMIN-ONLY ANALYTICS VIEW
-- Reports: share of likes going to the top 10% of posts, likes sent and received by gender, impressions per post
CREATE OR REPLACE VIEW public.admin_posts_feed_analytics AS
WITH post_stats AS (
  SELECT
    p.id AS post_id,
    p.author_id,
    p.like_count,
    p.impressions,
    pr.gender AS author_gender,
    NTILE(10) OVER (ORDER BY p.like_count DESC) AS decile
  FROM public.posts p
  JOIN public.profiles pr ON pr.id = p.author_id
  WHERE p.created_at >= NOW() - INTERVAL '30 days'
),
top_10_share AS (
  SELECT
    COALESCE(SUM(CASE WHEN decile = 1 THEN like_count ELSE 0 END), 0)::numeric /
    NULLIF(COALESCE(SUM(like_count), 0), 0)::numeric * 100.0 AS top_10_percent_like_share
  FROM post_stats
),
likes_by_gender AS (
  SELECT
    pr_sender.gender AS sender_gender,
    pr_author.gender AS recipient_gender,
    COUNT(pl.*) AS total_likes
  FROM public.post_likes pl
  JOIN public.profiles pr_sender ON pr_sender.id = pl.user_id
  JOIN public.posts p ON p.id = pl.post_id
  JOIN public.profiles pr_author ON pr_author.id = p.author_id
  WHERE pl.created_at >= NOW() - INTERVAL '30 days'
  GROUP BY pr_sender.gender, pr_author.gender
),
impressions_summary AS (
  SELECT
    COUNT(*) AS total_posts,
    AVG(impressions)::numeric(10,2) AS avg_impressions_per_post,
    AVG(like_count)::numeric(10,2) AS avg_likes_per_post
  FROM post_stats
)
SELECT
  (SELECT top_10_percent_like_share FROM top_10_share) AS top_10_percent_like_share,
  (SELECT avg_impressions_per_post FROM impressions_summary) AS avg_impressions_per_post,
  (SELECT avg_likes_per_post FROM impressions_summary) AS avg_likes_per_post,
  (SELECT JSON_AGG(ROW_TO_JSON(likes_by_gender)) FROM likes_by_gender) AS likes_by_gender_breakdown;
