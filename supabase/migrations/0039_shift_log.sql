-- Shift log support: multi-employer shift tracking with weekly goal gap metrics.

alter table public.user_preferences
  add column if not exists weekly_income_goal numeric not null default 2040 check (weekly_income_goal >= 0);

alter table public.user_preferences
  add column if not exists week_starts_on smallint not null default 0 check (week_starts_on in (0, 1));

create table if not exists public.employers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  short_code text not null,
  color text not null default '#2563EB',
  pay_schedule text not null default 'biweekly' check (pay_schedule in ('weekly', 'biweekly', 'semimonthly')),
  pay_lag_days integer not null default 14 check (pay_lag_days >= 0),
  pto_policy_hours_per_hour numeric null check (pto_policy_hours_per_hour is null or pto_policy_hours_per_hour >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, name),
  unique (user_id, short_code),
  unique (id, user_id)
);

create table if not exists public.employer_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  employer_id uuid not null,
  name text not null,
  short_code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, employer_id, name),
  unique (user_id, employer_id, short_code),
  unique (id, user_id),
  constraint employer_locations_employer_fk
    foreign key (employer_id, user_id)
    references public.employers (id, user_id)
    on delete cascade
);

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  shift_date date not null,
  employer_id uuid not null,
  location_id uuid null,
  hours_worked numeric(6,2) not null default 0 check (hours_worked >= 0),
  gross_pay numeric(10,2) not null default 0,
  notes text null,
  is_non_pay boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint shifts_employer_fk
    foreign key (employer_id, user_id)
    references public.employers (id, user_id)
    on delete cascade,
  constraint shifts_location_fk
    foreign key (location_id, user_id)
    references public.employer_locations (id, user_id)
    on delete set null,
  constraint shifts_non_pay_gross_check
    check ((not is_non_pay) or gross_pay = 0)
);

create index if not exists idx_employers_user_active_name
  on public.employers (user_id, is_active, name);

create index if not exists idx_locations_user_employer_active_name
  on public.employer_locations (user_id, employer_id, is_active, name);

create index if not exists idx_shifts_user_date_desc
  on public.shifts (user_id, shift_date desc);

create index if not exists idx_shifts_user_employer_date_desc
  on public.shifts (user_id, employer_id, shift_date desc);

create index if not exists idx_shifts_user_location_date_desc
  on public.shifts (user_id, location_id, shift_date desc);

alter table public.employers enable row level security;
alter table public.employer_locations enable row level security;
alter table public.shifts enable row level security;

create policy employers_select_own
  on public.employers
  for select
  using (user_id = auth.uid());

create policy employers_insert_own
  on public.employers
  for insert
  with check (user_id = auth.uid());

create policy employers_update_own
  on public.employers
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy employers_delete_own
  on public.employers
  for delete
  using (user_id = auth.uid());

create policy employer_locations_select_own
  on public.employer_locations
  for select
  using (user_id = auth.uid());

create policy employer_locations_insert_own
  on public.employer_locations
  for insert
  with check (user_id = auth.uid());

create policy employer_locations_update_own
  on public.employer_locations
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy employer_locations_delete_own
  on public.employer_locations
  for delete
  using (user_id = auth.uid());

create policy shifts_select_own
  on public.shifts
  for select
  using (user_id = auth.uid());

create policy shifts_insert_own
  on public.shifts
  for insert
  with check (user_id = auth.uid());

create policy shifts_update_own
  on public.shifts
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy shifts_delete_own
  on public.shifts
  for delete
  using (user_id = auth.uid());

-- Reuse the shared updated_at trigger helper from core migration.
do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_employers_set_updated_at'
  ) then
    create trigger trg_employers_set_updated_at
      before update on public.employers
      for each row
      execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_employer_locations_set_updated_at'
  ) then
    create trigger trg_employer_locations_set_updated_at
      before update on public.employer_locations
      for each row
      execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_shifts_set_updated_at'
  ) then
    create trigger trg_shifts_set_updated_at
      before update on public.shifts
      for each row
      execute function public.set_updated_at();
  end if;
end
$$;

