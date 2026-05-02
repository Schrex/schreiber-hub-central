-- Enable scheduling extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotency log for daily celebration job
create table if not exists public.celebration_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('birthday','anniversary')),
  event_date date not null,
  stage text not null check (stage in ('reminder_7','reminder_1','announcement')),
  created_at timestamp with time zone not null default now(),
  unique (user_id, kind, event_date, stage)
);

create index if not exists celebration_log_event_date_idx
  on public.celebration_log (event_date);

alter table public.celebration_log enable row level security;

create policy "Anyone signed in can view celebration log"
  on public.celebration_log for select
  to authenticated
  using (true);

create policy "Service role manages celebration log"
  on public.celebration_log for all
  to public
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');