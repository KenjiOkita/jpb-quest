export type ProjectRecord = {
    id: string
    name: string
    invite_code?: string | null
    created_at?: string | null
}

export async function fetchAccessibleProjects(supabase: any) {
    const { data, error } = await supabase.rpc('get_accessible_projects')

    if (error) {
        return {
            data: null,
            error,
        }
    }

    return {
        data: (data || []) as ProjectRecord[],
        error: null,
    }
}
