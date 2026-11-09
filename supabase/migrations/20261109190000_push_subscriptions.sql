create table if not exists public.push_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Subscriptions are written and read only by the Edge Function using the service role.
revoke all on public.push_subscriptions from anon, authenticated;
grant all on public.push_subscriptions to service_role;
