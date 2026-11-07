-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run

create table if not exists public.bills (
  id          bigint generated always as identity primary key,
  bill_number text        not null,            -- exactly as the admin typed it
  bill_key    text        not null unique,     -- trimmed + lowercase, used for matching
  created_at  timestamptz not null default now()
);

-- Lock the table: only your server (using the secret/service_role key) can read or write.
-- With RLS on and no policies, the public "anon" key cannot touch this table.
alter table public.bills enable row level security;
