-- =============================================
-- JPB Quest: パーティ役職変更機能（RPC）
-- Supabase SQL Editor で実行
-- =============================================

CREATE OR REPLACE FUNCTION public.set_project_member_role(
    target_project_id UUID,
    target_user_id UUID,
    new_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    actor_role TEXT;
    target_role TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'ログインが必要です。';
    END IF;

    IF new_role NOT IN ('admin', 'member') THEN
        RAISE EXCEPTION '変更先の役職が不正です。';
    END IF;

    SELECT role INTO actor_role
    FROM public.project_members
    WHERE project_id = target_project_id
      AND user_id = auth.uid();

    IF actor_role IS NULL THEN
        RAISE EXCEPTION 'このプロジェクトのメンバーではありません。';
    END IF;

    IF actor_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'この操作を実行する権限がありません。';
    END IF;

    SELECT role INTO target_role
    FROM public.project_members
    WHERE project_id = target_project_id
      AND user_id = target_user_id;

    IF target_role IS NULL THEN
        RAISE EXCEPTION '対象メンバーが見つかりません。';
    END IF;

    IF target_role = 'owner' THEN
        RAISE EXCEPTION 'オーナーの役職は変更できません。';
    END IF;

    IF actor_role = 'admin' AND target_role <> 'member' THEN
        RAISE EXCEPTION '軍師は一般メンバーのみ変更できます。';
    END IF;

    UPDATE public.project_members
    SET role = new_role
    WHERE project_id = target_project_id
      AND user_id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_project_member_role(UUID, UUID, TEXT) TO authenticated;
