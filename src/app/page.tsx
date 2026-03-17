import { createClient } from '@/lib/supabase/server'
import { fetchAccessibleProjects } from '@/lib/projects'
import { fetchAccessibleProjectMembers } from '@/lib/projectMembers'
import { fetchAccessibleTasks } from '@/lib/tasks'
import { fetchPublicProfiles } from '@/lib/supabase/publicProfiles'
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
  const { data: projects } = await fetchAccessibleProjects(supabase)

  // 3. Fetch tasks logic
  const { data: tasks } = await fetchAccessibleTasks(supabase)

  const { data: projectMembers } = await fetchAccessibleProjectMembers(supabase)

  const initialUserProfiles = await fetchPublicProfiles().catch(() => ({}))

  return (
    <DashboardClient
      initialProjects={projects || []}
      initialTasks={tasks || []}
      initialProjectMembers={projectMembers || []}
      initialUserProfiles={initialUserProfiles}
      user={user}
    />
  )
}
