-- =============================================
-- JPB Quest メディア対応拡張スクリプト (Hybrid v1)
-- =============================================

-- 1. commentsテーブルにメディアURLカラムを追加
-- エックスサーバー等に保存された画像のURLをここに格納します。
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. インデックスの追加（パフォーマンス向上のため）
CREATE INDEX IF NOT EXISTS idx_comments_image_url ON public.comments (image_url) WHERE image_url IS NOT NULL;
