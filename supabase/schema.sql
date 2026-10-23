-- ════════════════════════════════════════════════════════════════════════════
--  GritFit Fitness Center — Supabase Schema  (idempotent — safe to re-run)
--  Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Enums ──────────────────────────────────────────────────────────────────
do $$ begin
  create type public.user_role as enum ('admin', 'staff', 'trainer', 'client');
exception when duplicate_object then null; end $$;

alter type public.user_role add value if not exists 'trainer';

do $$ begin
  create type public.membership_plan as enum ('basic', 'premium', 'vip');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.membership_status as enum ('active', 'expired', 'cancelled', 'frozen');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invoice_status as enum ('paid', 'pending', 'overdue', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.booking_status as enum ('booked', 'waitlisted', 'cancelled', 'attended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('visa', 'mastercard', 'gcash', 'cash', 'other');
exception when duplicate_object then null; end $$;

-- ── 2. updated_at trigger function ───────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── 3. Profiles ───────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id               uuid        primary key references auth.users (id) on delete cascade,
  full_name        text        not null default '',
  avatar_initials  text        not null default '?',
  avatar_color     text        not null default 'lime',
  title            text        not null default 'Member',
  role             user_role   not null default 'client',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- ── 4. Auto-create profile on signup ─────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_initials, avatar_color, title, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',       ''),
    coalesce(new.raw_user_meta_data->>'avatar_initials', '?'),
    coalesce(new.raw_user_meta_data->>'avatar_color',    'lime'),
    coalesce(new.raw_user_meta_data->>'title',           'Basic Member'),
    'client'   -- role is always assigned by an admin, never from signup metadata
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 5. Memberships ────────────────────────────────────────────────────────────
create table if not exists public.memberships (
  id           uuid              primary key default gen_random_uuid(),
  client_id    uuid              not null references public.profiles (id) on delete cascade,
  plan         membership_plan   not null default 'basic',
  status       membership_status not null default 'active',
  started_at   date              not null default current_date,
  expires_at   date,
  price_cents  int               not null default 2900,  -- in cents: basic=$29, premium=$49, vip=$99
  created_at   timestamptz       not null default now(),
  updated_at   timestamptz       not null default now()
);

drop trigger if exists memberships_updated_at on public.memberships;
create trigger memberships_updated_at
  before update on public.memberships
  for each row execute function public.handle_updated_at();

-- ── 6. Trainers ───────────────────────────────────────────────────────────────
-- Extends a staff profile with trainer-specific data
create table if not exists public.trainers (
  id          uuid    primary key references public.profiles (id) on delete cascade,
  specialty   text    not null default '',
  bio         text    not null default '',
  rating      numeric(3,2) not null default 0.00,
  status      text    not null default 'active',   -- 'active' | 'part-time' | 'inactive'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trainers_updated_at on public.trainers;
create trigger trainers_updated_at
  before update on public.trainers
  for each row execute function public.handle_updated_at();

-- ── 7. Classes ────────────────────────────────────────────────────────────────
create table if not exists public.classes (
  id           uuid    primary key default gen_random_uuid(),
  title        text    not null,
  description  text    not null default '',
  trainer_id   uuid    references public.trainers (id) on delete set null,
  room         text    not null default '',
  color        text    not null default 'lime',   -- UI accent colour
  capacity     int     not null default 20,
  duration_min int     not null default 60,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists classes_updated_at on public.classes;
create trigger classes_updated_at
  before update on public.classes
  for each row execute function public.handle_updated_at();

-- ── 8. Class Sessions (scheduled occurrences of a class) ─────────────────────
create table if not exists public.class_sessions (
  id           uuid    primary key default gen_random_uuid(),
  class_id     uuid    not null references public.classes (id) on delete cascade,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  cancelled    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint   ends_after_starts check (ends_at > starts_at)
);

drop trigger if exists class_sessions_updated_at on public.class_sessions;
create trigger class_sessions_updated_at
  before update on public.class_sessions
  for each row execute function public.handle_updated_at();

-- ── 9. Bookings ───────────────────────────────────────────────────────────────
create table if not exists public.bookings (
  id          uuid           primary key default gen_random_uuid(),
  session_id  uuid           not null references public.class_sessions (id) on delete cascade,
  client_id   uuid           not null references public.profiles (id) on delete cascade,
  status      booking_status not null default 'booked',
  booked_at   timestamptz    not null default now(),
  updated_at  timestamptz    not null default now(),
  unique (session_id, client_id)
);

drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at
  before update on public.bookings
  for each row execute function public.handle_updated_at();

-- Enforce capacity: count non-cancelled bookings per session ≤ class capacity
create or replace function public.check_session_capacity()
returns trigger language plpgsql as $$
declare
  cap int;
  booked int;
begin
  if new.status not in ('booked', 'waitlisted') then
    return new;
  end if;
  select c.capacity into cap
  from public.class_sessions s
  join public.classes c on c.id = s.class_id
  where s.id = new.session_id;

  select count(*) into booked
  from public.bookings
  where session_id = new.session_id
    and status = 'booked'
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if new.status = 'booked' and booked >= cap then
    raise exception 'Session is fully booked (capacity: %)', cap;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_capacity_check on public.bookings;
create trigger bookings_capacity_check
  before insert or update on public.bookings
  for each row execute function public.check_session_capacity();

-- ── 10. Invoices ──────────────────────────────────────────────────────────────
create table if not exists public.invoices (
  id             uuid           primary key default gen_random_uuid(),
  client_id      uuid           not null references public.profiles (id) on delete cascade,
  membership_id  uuid           references public.memberships (id) on delete set null,
  description    text           not null,
  amount_cents   int            not null,
  status         invoice_status not null default 'pending',
  method         payment_method not null default 'cash',
  due_at         date           not null,
  paid_at        timestamptz,
  created_at     timestamptz    not null default now(),
  updated_at     timestamptz    not null default now()
);

drop trigger if exists invoices_updated_at on public.invoices;
create trigger invoices_updated_at
  before update on public.invoices
  for each row execute function public.handle_updated_at();

-- Auto-set paid_at when status flips to 'paid'
create or replace function public.handle_invoice_paid()
returns trigger language plpgsql as $$
begin
  if new.status = 'paid' and old.status <> 'paid' then
    new.paid_at = now();
  end if;
  if new.status <> 'paid' then
    new.paid_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_paid_at on public.invoices;
create trigger invoices_paid_at
  before update on public.invoices
  for each row execute function public.handle_invoice_paid();

-- ── 11. Check-ins ─────────────────────────────────────────────────────────────
create table if not exists public.checkins (
  id          uuid    primary key default gen_random_uuid(),
  client_id   uuid    not null references public.profiles (id) on delete cascade,
  session_id  uuid    references public.class_sessions (id) on delete set null,
  checked_in_at timestamptz not null default now(),
  note        text    not null default ''
);

-- ── 12. Useful views ──────────────────────────────────────────────────────────

-- Enrollment count per session (used by classes page)
create or replace view public.session_enrollment as
select
  s.id                                                          as session_id,
  s.class_id,
  s.starts_at,
  s.ends_at,
  s.cancelled,
  c.title,
  c.room,
  c.color,
  c.capacity,
  c.duration_min,
  p.full_name                                                   as trainer_name,
  count(b.id) filter (where b.status = 'booked')               as enrolled,
  count(b.id) filter (where b.status = 'waitlisted')           as waitlisted
from public.class_sessions s
join public.classes        c on c.id = s.class_id
left join public.trainers  t on t.id = c.trainer_id
left join public.profiles  p on p.id = t.id
left join public.bookings  b on b.session_id = s.id
group by s.id, c.id, p.full_name;

grant select on public.session_enrollment to authenticated;

-- Revenue summary per client
create or replace view public.client_revenue as
select
  i.client_id,
  p.full_name,
  sum(i.amount_cents) filter (where i.status = 'paid')    as paid_cents,
  sum(i.amount_cents) filter (where i.status = 'overdue') as overdue_cents,
  count(*)                                                 as invoice_count
from public.invoices i
join public.profiles p on p.id = i.client_id
group by i.client_id, p.full_name;

grant select on public.client_revenue to authenticated;

-- ── 13. RLS helpers ───────────────────────────────────────────────────────────
create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

create or replace function public.is_staff_or_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() in ('admin', 'staff'), false);
$$;

grant execute on function public.current_user_role()  to authenticated;
grant execute on function public.is_admin()           to authenticated;
grant execute on function public.is_staff_or_admin()  to authenticated;

-- ── 14. Row Level Security ────────────────────────────────────────────────────

-- profiles ────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "profiles: own read"    on public.profiles;
drop policy if exists "profiles: own update"  on public.profiles;
drop policy if exists "profiles: admin read"  on public.profiles;
drop policy if exists "profiles: admin write" on public.profiles;
drop policy if exists "profiles: admin delete" on public.profiles;

create policy "profiles: own read"
  on public.profiles for select using (auth.uid() = id);

create policy "profiles: own update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = public.current_user_role());

create policy "profiles: admin read"
  on public.profiles for select using (public.is_admin());

create policy "profiles: staff read"
  on public.profiles for select using (public.is_staff_or_admin());

create policy "profiles: admin write"
  on public.profiles for update using (public.is_admin());

create policy "profiles: admin delete"
  on public.profiles for delete using (public.is_admin());

-- memberships ─────────────────────────────────────────────────────────────────
alter table public.memberships enable row level security;

drop policy if exists "memberships: own read"    on public.memberships;
drop policy if exists "memberships: staff read"  on public.memberships;
drop policy if exists "memberships: admin write" on public.memberships;

create policy "memberships: own read"
  on public.memberships for select using (auth.uid() = client_id);

create policy "memberships: staff read"
  on public.memberships for select using (public.is_staff_or_admin());

create policy "memberships: admin write"
  on public.memberships for all using (public.is_admin());

-- trainers ────────────────────────────────────────────────────────────────────
alter table public.trainers enable row level security;

drop policy if exists "trainers: public read"  on public.trainers;
drop policy if exists "trainers: admin write"  on public.trainers;

create policy "trainers: public read"
  on public.trainers for select using (auth.uid() is not null);

create policy "trainers: admin write"
  on public.trainers for all using (public.is_admin());

-- classes ─────────────────────────────────────────────────────────────────────
alter table public.classes enable row level security;

drop policy if exists "classes: public read"  on public.classes;
drop policy if exists "classes: admin write"  on public.classes;

create policy "classes: public read"
  on public.classes for select using (auth.uid() is not null);

create policy "classes: admin write"
  on public.classes for all using (public.is_admin());

-- class_sessions ──────────────────────────────────────────────────────────────
alter table public.class_sessions enable row level security;

drop policy if exists "sessions: public read"  on public.class_sessions;
drop policy if exists "sessions: admin write"  on public.class_sessions;

create policy "sessions: public read"
  on public.class_sessions for select using (auth.uid() is not null);

create policy "sessions: admin write"
  on public.class_sessions for all using (public.is_admin());

-- bookings ────────────────────────────────────────────────────────────────────
alter table public.bookings enable row level security;

drop policy if exists "bookings: own read"    on public.bookings;
drop policy if exists "bookings: own insert"  on public.bookings;
drop policy if exists "bookings: own cancel"  on public.bookings;
drop policy if exists "bookings: staff read"  on public.bookings;
drop policy if exists "bookings: admin write" on public.bookings;

create policy "bookings: own read"
  on public.bookings for select using (auth.uid() = client_id);

create policy "bookings: own insert"
  on public.bookings for insert with check (auth.uid() = client_id);

create policy "bookings: own cancel"
  on public.bookings for update
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id and status = 'cancelled');

create policy "bookings: staff read"
  on public.bookings for select using (public.is_staff_or_admin());

create policy "bookings: admin write"
  on public.bookings for all using (public.is_admin());

-- invoices ────────────────────────────────────────────────────────────────────
alter table public.invoices enable row level security;

drop policy if exists "invoices: own read"    on public.invoices;
drop policy if exists "invoices: staff read"  on public.invoices;
drop policy if exists "invoices: admin write" on public.invoices;

create policy "invoices: own read"
  on public.invoices for select using (auth.uid() = client_id);

create policy "invoices: staff read"
  on public.invoices for select using (public.is_staff_or_admin());

create policy "invoices: admin write"
  on public.invoices for all using (public.is_admin());

-- checkins ────────────────────────────────────────────────────────────────────
alter table public.checkins enable row level security;

drop policy if exists "checkins: own read"    on public.checkins;
drop policy if exists "checkins: staff read"  on public.checkins;
drop policy if exists "checkins: staff insert" on public.checkins;
drop policy if exists "checkins: admin write" on public.checkins;

create policy "checkins: own read"
  on public.checkins for select using (auth.uid() = client_id);

create policy "checkins: staff read"
  on public.checkins for select using (public.is_staff_or_admin());

create policy "checkins: staff insert"
  on public.checkins for insert with check (public.is_staff_or_admin());

create policy "checkins: admin write"
  on public.checkins for all using (public.is_admin());

-- ── 15. Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_memberships_client    on public.memberships (client_id);
create index if not exists idx_class_sessions_start  on public.class_sessions (starts_at);
create index if not exists idx_class_sessions_class  on public.class_sessions (class_id);
create index if not exists idx_bookings_session      on public.bookings (session_id);
create index if not exists idx_bookings_client       on public.bookings (client_id);
create index if not exists idx_invoices_client       on public.invoices (client_id);
create index if not exists idx_invoices_status       on public.invoices (status);
create index if not exists idx_checkins_client       on public.checkins (client_id);
create index if not exists idx_checkins_date         on public.checkins (checked_in_at);

-- ── 16. Seed demo data ────────────────────────────────────────────────────────
/*
-- HOW TO SEED:
--   1. Go to Supabase Dashboard → Authentication → Users → Add user (x8)
--      Use "Create user" (not invite) so email is auto-confirmed.
--
--      lance@gritfit.com  / Admin123!   (admin)
--      diana@gritfit.com  / Admin123!   (admin)
--      marcus@gritfit.com / Staff123!   (staff / trainer)
--      elena@gritfit.com  / Staff123!   (staff / trainer)
--      ryan@gritfit.com   / Staff123!   (staff / trainer)
--      john@example.com   / Client123!  (client)
--      sarah@example.com  / Client123!  (client)
--      maria@example.com  / Client123!  (client)
--
--   2. Copy each user's UUID from the Auth → Users list.
--   3. Replace every placeholder below (uuid-lance, uuid-diana, …) with the real UUIDs.
--   4. Run the entire block in SQL Editor.


-- ── Profiles ──────────────────────────────────────────────────────────────────
insert into public.profiles (id, full_name, avatar_initials, avatar_color, title, role)
values
  ('uuid-lance',  'Lance Bolo',    'LB', 'lime',   'Club Manager',       'admin'),
  ('uuid-diana',  'Diana Cruz',    'DC', 'orange', 'Operations Manager', 'admin'),
  ('uuid-marcus', 'Coach Marcus',  'MA', 'orange', 'Head Trainer',       'staff'),
  ('uuid-elena',  'Elena Petrova', 'EP', 'blue',   'Yoga Instructor',    'staff'),
  ('uuid-ryan',   'Ryan Patel',    'RP', 'teal',   'Spin Instructor',    'staff'),
  ('uuid-john',   'John Doe',      'JD', 'orange', 'VIP Member',         'client'),
  ('uuid-sarah',  'Sarah Connor',  'SC', 'blue',   'Premium Member',     'client'),
  ('uuid-maria',  'Maria Lopez',   'ML', 'teal',   'Basic Member',       'client')
on conflict (id) do update
  set full_name       = excluded.full_name,
      avatar_initials = excluded.avatar_initials,
      avatar_color    = excluded.avatar_color,
      title           = excluded.title,
      role            = excluded.role,
      updated_at      = now();

-- ── Trainers ──────────────────────────────────────────────────────────────────
insert into public.trainers (id, specialty, bio, rating, status)
values
  ('uuid-marcus', 'CrossFit / HIIT', 'Head trainer with 10+ years in functional fitness.', 4.9, 'active'),
  ('uuid-elena',  'Yoga / Pilates',  'Certified yoga instructor specialising in Ashtanga.',  4.9, 'active'),
  ('uuid-ryan',   'Spin / Cycling',  'Competitive cyclist and certified spin coach.',         4.5, 'active')
on conflict (id) do update
  set specialty  = excluded.specialty,
      bio        = excluded.bio,
      rating     = excluded.rating,
      status     = excluded.status,
      updated_at = now();

-- ── Classes ───────────────────────────────────────────────────────────────────
insert into public.classes (id, title, trainer_id, room, color, capacity, duration_min)
values
  ('cls-hiit',     'HIIT Performance', 'uuid-marcus', 'Studio A',    'red',    12, 60),
  ('cls-crossfit', 'CrossFit WOD',     'uuid-marcus', 'Studio B',    'lime',   22, 60),
  ('cls-yoga',     'Ashtanga Yoga',    'uuid-elena',  'Mind & Body', 'teal',   25, 60),
  ('cls-pilates',  'Pilates',          'uuid-elena',  'Studio C',    'purple', 15, 60),
  ('cls-spin',     'Spin Cycle',       'uuid-ryan',   'Spin Studio', 'blue',   20, 60)
on conflict (id) do nothing;

-- ── Class Sessions (current week + next week, relative to seed date) ──────────
-- HIIT Mon/Wed/Fri/Sun 09:00
insert into public.class_sessions (id, class_id, starts_at, ends_at) values
  ('ses-hiit-mon',  'cls-hiit', now()::date + interval '0 days' + time '09:00', now()::date + interval '0 days' + time '10:00'),
  ('ses-hiit-wed',  'cls-hiit', now()::date + interval '2 days' + time '09:00', now()::date + interval '2 days' + time '10:00'),
  ('ses-hiit-fri',  'cls-hiit', now()::date + interval '4 days' + time '09:00', now()::date + interval '4 days' + time '10:00'),
  ('ses-hiit-sun',  'cls-hiit', now()::date + interval '6 days' + time '09:00', now()::date + interval '6 days' + time '10:00')
on conflict (id) do nothing;

-- CrossFit Mon/Wed/Fri 19:00
insert into public.class_sessions (id, class_id, starts_at, ends_at) values
  ('ses-cf-mon',  'cls-crossfit', now()::date + interval '0 days' + time '19:00', now()::date + interval '0 days' + time '20:00'),
  ('ses-cf-wed',  'cls-crossfit', now()::date + interval '2 days' + time '19:00', now()::date + interval '2 days' + time '20:00'),
  ('ses-cf-fri',  'cls-crossfit', now()::date + interval '4 days' + time '19:00', now()::date + interval '4 days' + time '20:00')
on conflict (id) do nothing;

-- Yoga Tue/Thu/Sat 09:00
insert into public.class_sessions (id, class_id, starts_at, ends_at) values
  ('ses-yoga-tue', 'cls-yoga', now()::date + interval '1 days' + time '09:00', now()::date + interval '1 days' + time '10:00'),
  ('ses-yoga-thu', 'cls-yoga', now()::date + interval '3 days' + time '09:00', now()::date + interval '3 days' + time '10:00'),
  ('ses-yoga-sat', 'cls-yoga', now()::date + interval '5 days' + time '09:00', now()::date + interval '5 days' + time '10:00')
on conflict (id) do nothing;

-- Spin Mon/Tue/Thu/Sat 08:00
insert into public.class_sessions (id, class_id, starts_at, ends_at) values
  ('ses-spin-mon', 'cls-spin', now()::date + interval '0 days' + time '08:00', now()::date + interval '0 days' + time '09:00'),
  ('ses-spin-tue', 'cls-spin', now()::date + interval '1 days' + time '08:00', now()::date + interval '1 days' + time '09:00'),
  ('ses-spin-thu', 'cls-spin', now()::date + interval '3 days' + time '08:00', now()::date + interval '3 days' + time '09:00'),
  ('ses-spin-sat', 'cls-spin', now()::date + interval '5 days' + time '08:00', now()::date + interval '5 days' + time '09:00')
on conflict (id) do nothing;

-- Pilates Tue/Thu 11:30
insert into public.class_sessions (id, class_id, starts_at, ends_at) values
  ('ses-pil-tue', 'cls-pilates', now()::date + interval '1 days' + time '11:30', now()::date + interval '1 days' + time '12:30'),
  ('ses-pil-thu', 'cls-pilates', now()::date + interval '3 days' + time '11:30', now()::date + interval '3 days' + time '12:30')
on conflict (id) do nothing;

-- ── Memberships ───────────────────────────────────────────────────────────────
insert into public.memberships (client_id, plan, status, started_at, expires_at, price_cents)
values
  ('uuid-john',  'vip',     'active', '2024-03-01', '2027-03-01', 9900),
  ('uuid-sarah', 'premium', 'active', '2024-06-01', '2027-06-01', 4900),
  ('uuid-maria', 'basic',   'active', '2025-01-01', '2026-01-01', 2900)
on conflict do nothing;

-- ── Bookings ──────────────────────────────────────────────────────────────────
-- john: HIIT Mon, CrossFit Mon, Yoga Tue
insert into public.bookings (session_id, client_id, status) values
  ('ses-hiit-mon', 'uuid-john',  'booked'),
  ('ses-cf-mon',   'uuid-john',  'booked'),
  ('ses-yoga-tue', 'uuid-john',  'booked')
on conflict do nothing;

-- sarah: Yoga Tue, Spin Mon, Pilates Tue
insert into public.bookings (session_id, client_id, status) values
  ('ses-yoga-tue', 'uuid-sarah', 'booked'),
  ('ses-spin-mon', 'uuid-sarah', 'booked'),
  ('ses-pil-tue',  'uuid-sarah', 'booked')
on conflict do nothing;

-- maria: Spin Tue, Pilates Thu
insert into public.bookings (session_id, client_id, status) values
  ('ses-spin-tue', 'uuid-maria', 'booked'),
  ('ses-pil-thu',  'uuid-maria', 'booked')
on conflict do nothing;

-- ── Invoices ──────────────────────────────────────────────────────────────────
insert into public.invoices (client_id, description, amount_cents, status, method, due_at, paid_at)
values
  ('uuid-john',  'VIP Membership — Sep 2026',     9900,  'paid',    'visa',       '2026-09-01', now()),
  ('uuid-john',  'VIP Membership — Aug 2026',     9900,  'paid',    'visa',       '2026-08-01', now() - interval '30 days'),
  ('uuid-john',  'Personal Training (4 sessions)',12000, 'paid',    'visa',       '2026-08-15', now() - interval '15 days'),
  ('uuid-sarah', 'Premium Membership — Sep 2026', 4900,  'paid',    'gcash',      '2026-09-01', now()),
  ('uuid-sarah', 'Premium Membership — Aug 2026', 4900,  'paid',    'gcash',      '2026-08-01', now() - interval '30 days'),
  ('uuid-sarah', 'Class Pack (10)',               7500,  'overdue', 'mastercard', '2026-09-10', null),
  ('uuid-maria', 'Basic Membership — Sep 2026',   2900,  'paid',    'cash',       '2026-09-01', now()),
  ('uuid-maria', 'Basic Membership — Aug 2026',   2900,  'paid',    'cash',       '2026-08-01', now() - interval '30 days')
on conflict do nothing;

-- ── Check-ins (today) ─────────────────────────────────────────────────────────
insert into public.checkins (client_id, session_id, checked_in_at, note) values
  ('uuid-john',  'ses-hiit-mon', now() - interval '2 hours',  ''),
  ('uuid-sarah', 'ses-spin-mon', now() - interval '3 hours',  ''),
  ('uuid-maria', 'ses-spin-mon', now() - interval '3 hours 10 minutes', '')
on conflict do nothing;
*/

-- ── Runnable class catalog and upcoming sessions ────────────────────────────
-- Uses generated UUIDs so this works without manually-created demo accounts.
-- Safe to rerun: existing classes and session times are left in place.
insert into public.classes (title, room, color, capacity, duration_min)
select seed.title, seed.room, seed.color, seed.capacity, 60
from (values
  ('HIIT Performance', 'Studio A', 'red',    12),
  ('CrossFit WOD',     'Studio B', 'lime',   22),
  ('Ashtanga Yoga',    'Mind & Body', 'teal',25),
  ('Pilates',          'Studio C', 'purple', 15),
  ('Spin Cycle',       'Spin Studio', 'blue',20)
) as seed(title, room, color, capacity)
where not exists (
  select 1 from public.classes c where lower(c.title) = lower(seed.title)
);

with schedule(title, day_of_week, start_time) as (
  values
    ('HIIT Performance', 1, time '09:00'),
    ('HIIT Performance', 3, time '09:00'),
    ('HIIT Performance', 5, time '09:00'),
    ('HIIT Performance', 0, time '09:00'),
    ('CrossFit WOD',     1, time '19:00'),
    ('CrossFit WOD',     3, time '19:00'),
    ('CrossFit WOD',     5, time '19:00'),
    ('Ashtanga Yoga',    2, time '09:00'),
    ('Ashtanga Yoga',    4, time '09:00'),
    ('Ashtanga Yoga',    6, time '09:00'),
    ('Pilates',          2, time '11:30'),
    ('Pilates',          4, time '11:30'),
    ('Spin Cycle',       1, time '08:00'),
    ('Spin Cycle',       2, time '08:00'),
    ('Spin Cycle',       4, time '08:00'),
    ('Spin Cycle',       6, time '08:00')
), dates as (
  select day::date as day
  from generate_series(current_date, current_date + 13, interval '1 day') as days(day)
), occurrences as (
  select
    c.id as class_id,
    d.day,
    s.start_time,
    (d.day + s.start_time) at time zone 'Asia/Manila' as starts_at,
    (d.day + s.start_time + interval '60 minutes') at time zone 'Asia/Manila' as ends_at
  from schedule s
  join dates d on extract(dow from d.day)::int = s.day_of_week
  join public.classes c on lower(c.title) = lower(s.title)
)
insert into public.class_sessions (id, class_id, starts_at, ends_at)
select
  (substr(hash, 1, 8) || '-' || substr(hash, 9, 4) || '-' || substr(hash, 13, 4) || '-' ||
   substr(hash, 17, 4) || '-' || substr(hash, 21, 12))::uuid,
  o.class_id,
  o.starts_at,
  o.ends_at
from occurrences o
cross join lateral (select md5(o.class_id::text || '|' || o.starts_at::text) as hash) h
where not exists (
  select 1 from public.class_sessions existing
  where existing.class_id = o.class_id and existing.starts_at = o.starts_at
)
on conflict (id) do nothing;
