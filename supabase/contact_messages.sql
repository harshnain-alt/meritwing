-- Meritwing contact form: one row per message sent from the landing page.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this → Run.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  message text not null check (char_length(message) between 1 and 2000)
);

-- Row-Level Security: with it on, the public (anon) key can do only what a policy allows.
alter table public.contact_messages enable row level security;

-- The website may add a message, and nothing else. There are no select, update or delete
-- policies, so the public key can never read, change or remove submissions; you see them in
-- the dashboard (Table Editor → contact_messages).
drop policy if exists "Website can add contact messages" on public.contact_messages;
create policy "Website can add contact messages"
  on public.contact_messages
  for insert
  to anon
  with check (true);
