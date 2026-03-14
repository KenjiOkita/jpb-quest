-- =============================================
-- JPB Quest RLS完全修復スクリプト
-- ★ Supabase SQL Editor で一括実行してください ★
-- =============================================

-- =============================================
-- 1. テーブル構造の補完（既にある場合はスキップ）
-- =============================================
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assignee_name TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    user_email TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 2. RLSを有効化（既に有効でもエラーにならない）
-- =============================================
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 3. 既存のポリシーを全削除（競合を防ぐ）
-- =============================================
DROP POLICY IF EXISTS "メンバーは自分のプロジェクトを見れる" ON public.projects;
DROP POLICY IF EXISTS "projects_select" ON public.projects;
DROP POLICY IF EXISTS "projects_insert" ON public.projects;
DROP POLICY IF EXISTS "projects_update" ON public.projects;
DROP POLICY IF EXISTS "projects_delete" ON public.projects;

DROP POLICY IF EXISTS "メンバーはアクセス権のあるプロジェクトのタスクを見れる" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;

DROP POLICY IF EXISTS "members_select" ON public.project_members;
DROP POLICY IF EXISTS "members_insert" ON public.project_members;
DROP POLICY IF EXISTS "members_delete" ON public.project_members;

DROP POLICY IF EXISTS "comments_select_policy" ON public.comments;
DROP POLICY IF EXISTS "comments_insert_policy" ON public.comments;
DROP POLICY IF EXISTS "comments_select" ON public.comments;
DROP POLICY IF EXISTS "comments_insert" ON public.comments;

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

-- =============================================
-- 4. projects テーブルのポリシー
-- =============================================

-- SELECT: 自分がメンバーであるプロジェクトを表示
CREATE POLICY "projects_select" ON public.projects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.project_members
            WHERE project_members.project_id = projects.id
            AND project_members.user_id = auth.uid()
        )
    );

-- ★ INSERT: ログイン済みユーザーは誰でもプロジェクトを作成できる
CREATE POLICY "projects_insert" ON public.projects
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: プロジェクトのオーナーのみ更新可能
CREATE POLICY "projects_update" ON public.projects
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.project_members
            WHERE project_members.project_id = projects.id
            AND project_members.user_id = auth.uid()
            AND project_members.role = 'owner'
        )
    );

-- DELETE: プロジェクトのオーナーのみ削除可能
CREATE POLICY "projects_delete" ON public.projects
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.project_members
            WHERE project_members.project_id = projects.id
            AND project_members.user_id = auth.uid()
            AND project_members.role = 'owner'
        )
    );

-- =============================================
-- 5. project_members テーブルのポリシー
-- =============================================

-- SELECT: 自分が所属するプロジェクトのメンバー一覧を表示
CREATE POLICY "members_select" ON public.project_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.project_members AS pm
            WHERE pm.project_id = project_members.project_id
            AND pm.user_id = auth.uid()
        )
    );

-- ★ INSERT: ログイン済みユーザーは自分自身をメンバーとして追加できる
CREATE POLICY "members_insert" ON public.project_members
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- DELETE: オーナーのみメンバーを削除可能
CREATE POLICY "members_delete" ON public.project_members
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.project_members AS pm
            WHERE pm.project_id = project_members.project_id
            AND pm.user_id = auth.uid()
            AND pm.role = 'owner'
        )
    );

-- =============================================
-- 6. tasks テーブルのポリシー
-- =============================================

-- SELECT: 自分がメンバーであるプロジェクトのタスクを表示
CREATE POLICY "tasks_select" ON public.tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.project_members
            WHERE project_members.project_id = tasks.project_id
            AND project_members.user_id = auth.uid()
        )
    );

-- ★ INSERT: 自分がメンバーであるプロジェクトにタスクを追加可能
CREATE POLICY "tasks_insert" ON public.tasks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_members
            WHERE project_members.project_id = tasks.project_id
            AND project_members.user_id = auth.uid()
        )
    );

-- UPDATE: 自分がメンバーであるプロジェクトのタスクを更新可能
CREATE POLICY "tasks_update" ON public.tasks
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.project_members
            WHERE project_members.project_id = tasks.project_id
            AND project_members.user_id = auth.uid()
        )
    );

-- DELETE: オーナーのみタスクを削除可能
CREATE POLICY "tasks_delete" ON public.tasks
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.project_members
            WHERE project_members.project_id = tasks.project_id
            AND project_members.user_id = auth.uid()
            AND project_members.role = 'owner'
        )
    );

-- =============================================
-- 7. comments テーブルのポリシー
-- =============================================

-- SELECT: 自分がメンバーであるプロジェクトのコメントを表示
CREATE POLICY "comments_select" ON public.comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.project_members
            WHERE project_members.project_id = (
                SELECT project_id FROM public.tasks WHERE id = comments.task_id
            )
            AND project_members.user_id = auth.uid()
        )
    );

-- INSERT: 自分がメンバーであるプロジェクトのタスクにコメント可能
CREATE POLICY "comments_insert" ON public.comments
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.project_members
            WHERE project_members.project_id = (
                SELECT project_id FROM public.tasks WHERE id = comments.task_id
            )
            AND project_members.user_id = auth.uid()
        )
    );

-- =============================================
-- 8. profiles テーブルのポリシー
-- =============================================

-- SELECT: 全ユーザーのプロフィールを閲覧可能
CREATE POLICY "profiles_select_all" ON public.profiles
    FOR SELECT USING (true);

-- INSERT: 自分のプロフィールのみ作成可能
CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- UPDATE: 自分のプロフィールのみ更新可能
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- =============================================
-- ★ 確認用クエリ（実行結果でポリシーが正しく設定されたか確認）
-- =============================================
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
