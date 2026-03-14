-- プロジェクトテーブル
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- タスクテーブル
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  status text not null default 'unstarted', -- 'unstarted', 'progress', 'completed', 'blocked'
  assignee_id uuid references auth.users(id), -- ここは後ほど補足が必要
  due_date timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- プロジェクトメンバー（アクセス権）テーブル
create table public.project_members (
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'member',
  primary key (project_id, user_id)
);

-- 行レベルセキュリティ (RLS) の有効化
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.project_members enable row level security;

-- ポリシー設定: プロジェクトへのアクセス権
-- (自分が project_members に登録されているプロジェクトのみ見れる)
create policy "メンバーは自分のプロジェクトを見れる"
  on public.projects
  for select
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = projects.id
      and project_members.user_id = auth.uid()
    )
  );

-- ポリシー設定: タスクへのアクセス権
-- (自分が見れるプロジェクトのタスクのみ見れる)
create policy "メンバーはアクセス権のあるプロジェクトのタスクを見れる"
  on public.tasks
  for select
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = tasks.project_id
      and project_members.user_id = auth.uid()
    )
  );
