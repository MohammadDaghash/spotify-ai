-- Supabase setup for private per-user recommendation feedback.
-- Run this in the Supabase SQL editor for the project used by:
-- VITE_SUPABASE_URL
-- VITE_SUPABASE_ANON_KEY

create table if not exists public.user_feedback_events (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  event_timestamp timestamptz not null,
  action text not null,
  label text not null,
  item_type text not null,
  item_key text not null,
  item_name text not null,
  item_artist text,
  item_album text,
  score double precision,
  relative_match double precision,
  reason text,
  source text,
  mode text,
  context jsonb not null default '{}'::jsonb
);

alter table public.user_feedback_events enable row level security;

drop policy if exists "Users can read own feedback events"
on public.user_feedback_events;

create policy "Users can read own feedback events"
on public.user_feedback_events
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own feedback events"
on public.user_feedback_events;

create policy "Users can insert own feedback events"
on public.user_feedback_events
for insert
to authenticated
with check (auth.uid() = user_id);

create index if not exists user_feedback_events_user_time_idx
on public.user_feedback_events (user_id, event_timestamp desc);
