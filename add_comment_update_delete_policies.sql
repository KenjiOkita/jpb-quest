-- =============================================
-- JPB Quest: コメントの編集・削除ポリシー
-- Supabase SQL Editor で実行
-- =============================================

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_update_policy" ON public.comments;
CREATE POLICY "comments_update_policy" ON public.comments
    FOR UPDATE USING (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.project_members
            WHERE project_members.project_id = (
                SELECT project_id FROM public.tasks WHERE id = comments.task_id
            )
            AND project_members.user_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() = user_id
    );

DROP POLICY IF EXISTS "comments_delete_policy" ON public.comments;
CREATE POLICY "comments_delete_policy" ON public.comments
    FOR DELETE USING (
        (
            auth.uid() = user_id
            OR EXISTS (
                SELECT 1 FROM public.project_members
                WHERE project_members.project_id = (
                    SELECT project_id FROM public.tasks WHERE id = comments.task_id
                )
                AND project_members.user_id = auth.uid()
                AND project_members.role IN ('owner', 'admin')
            )
        )
    );
