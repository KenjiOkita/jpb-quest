-- =============================================
-- JPB Quest: 完了履歴（完了者）を記録するための拡張
-- Supabase SQL Editor で実行
-- =============================================

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS completed_by_user_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'tasks_completed_by_user_id_fkey'
    ) THEN
        ALTER TABLE public.tasks
        ADD CONSTRAINT tasks_completed_by_user_id_fkey
        FOREIGN KEY (completed_by_user_id)
        REFERENCES auth.users(id)
        ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON public.tasks (completed_at) WHERE completed_at IS NOT NULL;
