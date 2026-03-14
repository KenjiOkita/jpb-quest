-- =============================================
-- JPB Quest データベース修復スクリプト
-- =============================================

-- 1. tasksテーブルの不足カラムを追加
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assignee_name TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- 2. commentsテーブルの作成
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    user_email TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. commentsテーブルのRLS（行レベルセキュリティ）設定
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 自分がアクセス権を持つプロジェクトのタスクのコメントのみ閲覧可能
DROP POLICY IF EXISTS "comments_select_policy" ON public.comments;
CREATE POLICY "comments_select_policy" ON public.comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.project_members
            WHERE project_members.project_id = (
                SELECT project_id FROM public.tasks WHERE id = comments.task_id
            )
            AND project_members.user_id = auth.uid()
        )
    );

-- 自分がアクセス権を持つプロジェクトのタスクにのみコメント投稿可能
DROP POLICY IF EXISTS "comments_insert_policy" ON public.comments;
CREATE POLICY "comments_insert_policy" ON public.comments
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
