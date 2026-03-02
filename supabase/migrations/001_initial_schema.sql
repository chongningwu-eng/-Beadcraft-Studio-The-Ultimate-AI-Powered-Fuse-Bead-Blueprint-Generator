-- ============================================================
-- BeadCraft Studio — Supabase Database Schema
-- 在 Supabase Dashboard → SQL Editor 中执行此文件
-- ============================================================

-- ==================== PROFILES ====================
-- 用户业务扩展表，关联 Supabase Auth
CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username    TEXT UNIQUE,
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 新用户注册时自动创建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 如果 trigger 已存在则先删除
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- ==================== BLUEPRINTS ====================
-- 图纸资产表
CREATE TABLE IF NOT EXISTS public.blueprints (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- 创作元数据
    title               TEXT DEFAULT '未命名图纸',
    mode                TEXT NOT NULL CHECK (mode IN ('basic', 'redraw', 'create')),
    board_width         INT NOT NULL,
    board_height        INT NOT NULL,
    bleed               INT DEFAULT 1,
    brand               TEXT DEFAULT 'mard',

    -- 图片资产路径（Supabase Storage）
    original_image_path TEXT,
    pixel_image_path    TEXT,
    thumbnail_path      TEXT,

    -- BOM 材料清单
    bom                 JSONB NOT NULL,
    -- 格式: [{"id": "A1", "hex": "#FAF5CD", "count": 42}, ...]

    total_beads         INT NOT NULL,
    color_count         INT NOT NULL,

    -- 时间戳
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_blueprints_user_id ON public.blueprints(user_id);
CREATE INDEX IF NOT EXISTS idx_blueprints_created_at ON public.blueprints(created_at DESC);

-- RLS
ALTER TABLE public.blueprints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own blueprints" ON public.blueprints;
CREATE POLICY "Users can view own blueprints" ON public.blueprints
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own blueprints" ON public.blueprints;
CREATE POLICY "Users can insert own blueprints" ON public.blueprints
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own blueprints" ON public.blueprints;
CREATE POLICY "Users can update own blueprints" ON public.blueprints
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own blueprints" ON public.blueprints;
CREATE POLICY "Users can delete own blueprints" ON public.blueprints
    FOR DELETE USING (auth.uid() = user_id);

-- ==================== STORAGE BUCKETS ====================
-- 需要在 Supabase Dashboard → Storage 中手动创建以下两个 Bucket：
-- 1. originals  (Private) — 用户上传的原始图片
-- 2. pixels     (Private) — 生成的像素图 / 缩略图

-- ============================================================
-- 执行完毕。请在 Supabase Dashboard → Storage 中手动创建 Bucket。
-- ============================================================
