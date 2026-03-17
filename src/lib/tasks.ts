export type TaskRecord = {
    id: string
    project_id: string
    title: string
    status: string
    assignee_id?: string | null
    assignee_name?: string | null
    priority?: string | null
    due_date?: string | null
    order_index?: number | null
    created_at?: string | null
    updated_at?: string | null
    completed_at?: string | null
}

export async function fetchAccessibleTasks(supabase: any) {
    const { data, error } = await supabase.rpc('get_accessible_tasks')

    if (error) {
        return {
            data: null,
            error,
        }
    }

    return {
        data: (data || []) as TaskRecord[],
        error: null,
    }
}
