-- Webプッシュ通知の購読情報を保存するテーブル
create table if not exists public.push_subscriptions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    endpoint text not null,
    p256dh text not null,
    auth text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, endpoint)
);

-- RLS（行レベルセキュリティ）の設定
alter table public.push_subscriptions enable row level security;

-- 自分の購読情報のみ操作可能
create policy "Users can manage their own subscriptions"
    on public.push_subscriptions
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- インデックス作成
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
