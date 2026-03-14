-- 1. 招待コード（invite_code）をプロジェクトテーブルに追加
ALTER TABLE projects ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- 2. 既存のプロジェクトにランダムな招待コードを生成（初期設定）
UPDATE projects SET invite_code = substring(md5(random()::text), 1, 8) WHERE invite_code IS NULL;

-- 3. project_members テーブルのロール（権限）を拡張（もし必要なら）
-- すでに 'owner', 'admin', 'member' がある想定ですが、'manager' を追加したり整理したりします。
-- 今回は既存の 'admin' を「軍師（マネージャー）」として扱います。

-- 4. 閲覧制限（RLS）の強化
-- 自分がメンバーであるプロジェクト、または自分が作成したタスクのみが見えるように設定
DROP POLICY IF EXISTS "projects_select_temp" ON projects;
CREATE POLICY "projects_select_policy" ON projects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_members.project_id = projects.id 
            AND project_members.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "tasks_select_temp" ON tasks;
CREATE POLICY "tasks_select_policy" ON tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_members.project_id = tasks.project_id 
            AND project_members.user_id = auth.uid()
        )
    );

-- 5. 招待コードでプロジェクトに参加するための関数
CREATE OR REPLACE FUNCTION join_project_by_code(target_invite_code TEXT)
RETURNS VOID AS $$
DECLARE
    target_project_id UUID;
BEGIN
    -- 招待コードに一致するプロジェクトIDを取得
    SELECT id INTO target_project_id FROM projects WHERE invite_code = target_invite_code;
    
    IF target_project_id IS NULL THEN
        RAISE EXCEPTION '指定された招待コード（呪文）は無効です。';
    END IF;

    -- すでにメンバーでないか確認して追加
    INSERT INTO project_members (project_id, user_id, role)
    VALUES (target_project_id, auth.uid(), 'member')
    ON CONFLICT (project_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
