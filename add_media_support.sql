-- =============================================
-- JPB Quest メディア対応拡張スクリプト
-- =============================================

-- 1. commentsテーブルにメディアURLカラムを追加
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. メディア保存用のストレージバケットを作成（すでに存在する場合はスキップ）
-- 注: この部分はSupabase管理画面のStorageからも作成可能です。
-- bucket_id: 'comment_images'

-- 3. ストレージ利用のためのRLSポリシー（バケット作成後、SQL Editorで個別に実行が必要な場合があります）
-- =============================================
-- 以下は参考情報としてのポリシー設定例です
-- =============================================
/*
-- 認証済みユーザーなら誰でもアップロード可能
CREATE POLICY "Allow authenticated upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'comment_images' AND auth.role() = 'authenticated'
);

-- 誰でも閲覧可能
CREATE POLICY "Allow public select" ON storage.objects FOR SELECT USING (
  bucket_id = 'comment_images'
);
*/
