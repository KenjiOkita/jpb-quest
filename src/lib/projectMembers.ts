export type ProjectMemberRecord = {
    project_id: string
    user_id: string
    role: string
}

export async function fetchAccessibleProjectMembers(supabase: any) {
    const { data, error } = await supabase.rpc('get_accessible_project_members')

    if (error) {
        return {
            data: null,
            error,
        }
    }

    return {
        data: (data || []) as ProjectMemberRecord[],
        error: null,
    }
}

export async function fetchProjectMembersForProject(supabase: any, projectId: string) {
    const { data, error } = await supabase.rpc('get_project_members_for_project', {
        target_project_id: projectId,
    })

    if (error) {
        return {
            data: null,
            error,
        }
    }

    return {
        data: (data || []) as ProjectMemberRecord[],
        error: null,
    }
}
