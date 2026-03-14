-- =============================================
-- profiles テーブルの作成
-- Supabase Dashboard > SQL Editor で実行してください
-- =============================================

-- プロフィールテーブル
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS（Row Level Security）を有効化
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 自分のプロフィールは誰でも閲覧可能（チームメンバーの名前や写真を見るため）
CREATE POLICY "profiles_select_all" ON public.profiles
    FOR SELECT USING (true);

-- 自分のプロフィールのみ更新可能
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- 自分のプロフィールのみ作成可能
CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- =============================================
-- avatars ストレージバケットの作成（まだなければ）
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- avatarsバケットへのアップロードポリシー
CREATE POLICY "avatars_upload" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- avatarsバケットの公開読み取りポリシー
CREATE POLICY "avatars_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');


-- =============================================
-- ★ 追加確認：既存テーブルのRLSポリシーも確認
-- 以下のSQLで、projects と tasks のSELECTポリシーが
-- 正しく設定されているか確認してください
-- =============================================

-- プロジェクトのSELECTポリシー確認
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('projects', 'tasks', 'comments', 'project_members');
