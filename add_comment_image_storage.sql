-- =============================================
-- JPB Quest コメント画像用 Supabase Storage 設定
-- Supabase Dashboard > SQL Editor で実行してください
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('comment-images', 'comment-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "comment_images_upload" ON storage.objects;
CREATE POLICY "comment_images_upload" ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'comment-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "comment_images_public_read" ON storage.objects;
CREATE POLICY "comment_images_public_read" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'comment-images');
