-- =============================================
-- ステップ1: 現状確認
-- まず今のproject_membersの中身を確認しましょう
-- =============================================

-- 全てのプロジェクトメンバーシップを表示
SELECT pm.*, p.name as project_name 
FROM project_members pm 
LEFT JOIN projects p ON pm.project_id = p.id;

-- 現在のユーザーID一覧（auth.usersから）
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;
