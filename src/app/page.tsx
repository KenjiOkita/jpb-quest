import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function Home() {
  return <DashboardContainer />
}

async function DashboardContainer() {
  const supabase = await createClient()

  // 1. Get user session
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // 2. Fetch projects logic mapping to their RLS policies
  const { data: projects, error: _projectsError } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: true })

  // 3. Fetch tasks logic
  const { data: tasks, error: _tasksError } = await supabase
    .from('tasks')
    .select('*, assignee_id')
    .order('created_at', { ascending: false })

  // Note: For a real app with many users, we should join with auth.users or a profiles table.
  // For this prototype, we'll map the assignee to the user email or generic avatar if needed.
  // However, Supabase auth.users is NOT queryable by default from the frontend/anon role. 
  // We'll manage it simply in the client component.

  return (
    <DashboardClient
      initialProjects={projects || []}
      initialTasks={tasks || []}
      user={user}
    />
  )
}
