-- 既存の外部キー制約の名を特定（通常は tasks_assignee_id_fkey）
-- 特定できない場合でもエラーにならないよう、一度制約を削除して再定義します
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_assignee_id_fkey;

-- ユーザーが削除されたら担当者をNULLにする（タスク自体は残す）設定で再追加
ALTER TABLE public.tasks 
ADD CONSTRAINT tasks_assignee_id_fkey 
FOREIGN KEY (assignee_id) 
REFERENCES auth.users(id) 
ON DELETE SET NULL;
