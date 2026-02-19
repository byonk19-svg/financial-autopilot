-- Savings envelope system: buckets, contributions, balance refresh trigger, and summary RPC.

create table if not exists public.savings_buckets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  owner text not null default 'household',
  target_amount numeric(12,2) null,
  current_balance numeric(12,2) not null default 0 check (current_balance >= 0),
  allocation_pct numeric(5,4) null check (
    allocation_pct is null
    or (allocation_pct >= 0 and allocation_pct <= 1)
  ),
  weekly_target numeric(10,2) null check (weekly_target is null or weekly_target >= 0),
  goal_date date null,
  priority smallint not null default 0,
  is_active boolean not null default true,
  notes text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint savings_buckets_owner_check check (owner in ('brianna', 'elaine', 'household')),
  constraint savings_buckets_single_funding_mode_check check (
    not (allocation_pct is not null and weekly_target is not null)
  ),
  constraint savings_buckets_user_name_key unique (user_id, name),
  constraint savings_buckets_id_user_id_key unique (id, user_id)
);

create table if not exists public.savings_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket_id uuid not null,
  transaction_id uuid null references public.transactions (id) on delete set null,
  amount numeric(10,2) not null check (amount > 0),
  contribution_date date not null,
  note text null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint savings_contributions_bucket_fk
    foreign key (bucket_id, user_id)
    references public.savings_buckets (id, user_id)
    on delete cascade
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.savings_buckets'::regclass
      and conname = 'savings_buckets_owner_check'
  ) then
    alter table public.savings_buckets
      add constraint savings_buckets_owner_check
      check (owner in ('brianna', 'elaine', 'household'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.savings_buckets'::regclass
      and conname = 'savings_buckets_single_funding_mode_check'
  ) then
    alter table public.savings_buckets
      add constraint savings_buckets_single_funding_mode_check
      check (not (allocation_pct is not null and weekly_target is not null));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.savings_buckets'::regclass
      and conname = 'savings_buckets_user_name_key'
  ) then
    alter table public.savings_buckets
      add constraint savings_buckets_user_name_key unique (user_id, name);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.savings_buckets'::regclass
      and conname = 'savings_buckets_id_user_id_key'
  ) then
    alter table public.savings_buckets
      add constraint savings_buckets_id_user_id_key unique (id, user_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.savings_contributions'::regclass
      and conname = 'savings_contributions_bucket_fk'
  ) then
    alter table public.savings_contributions
      add constraint savings_contributions_bucket_fk
      foreign key (bucket_id, user_id)
      references public.savings_buckets (id, user_id)
      on delete cascade;
  end if;
end
$$;

create index if not exists idx_savings_buckets_user_active_priority
  on public.savings_buckets (user_id, is_active, priority);

create index if not exists idx_savings_buckets_user_owner
  on public.savings_buckets (user_id, owner);

create index if not exists idx_savings_contributions_user_bucket_date_desc
  on public.savings_contributions (user_id, bucket_id, contribution_date desc);

create index if not exists idx_savings_contributions_transaction_id
  on public.savings_contributions (transaction_id)
  where transaction_id is not null;

create or replace function public.refresh_bucket_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.savings_buckets sb
    set current_balance = coalesce((
      select round(sum(sc.amount), 2)
      from public.savings_contributions sc
      where sc.user_id = new.user_id
        and sc.bucket_id = new.bucket_id
    ), 0)
    where sb.user_id = new.user_id
      and sb.id = new.bucket_id;
  elsif tg_op = 'DELETE' then
    update public.savings_buckets sb
    set current_balance = coalesce((
      select round(sum(sc.amount), 2)
      from public.savings_contributions sc
      where sc.user_id = old.user_id
        and sc.bucket_id = old.bucket_id
    ), 0)
    where sb.user_id = old.user_id
      and sb.id = old.bucket_id;
  else
    if old.user_id is distinct from new.user_id or old.bucket_id is distinct from new.bucket_id then
      update public.savings_buckets sb
      set current_balance = coalesce((
        select round(sum(sc.amount), 2)
        from public.savings_contributions sc
        where sc.user_id = old.user_id
          and sc.bucket_id = old.bucket_id
      ), 0)
      where sb.user_id = old.user_id
        and sb.id = old.bucket_id;
    end if;

    update public.savings_buckets sb
    set current_balance = coalesce((
      select round(sum(sc.amount), 2)
      from public.savings_contributions sc
      where sc.user_id = new.user_id
        and sc.bucket_id = new.bucket_id
    ), 0)
    where sb.user_id = new.user_id
      and sb.id = new.bucket_id;
  end if;

  return null;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_savings_contributions_refresh_bucket_balance'
  ) then
    create trigger trg_savings_contributions_refresh_bucket_balance
      after insert or update or delete on public.savings_contributions
      for each row
      execute function public.refresh_bucket_balance();
  end if;
end
$$;

alter table public.savings_buckets enable row level security;
alter table public.savings_contributions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'savings_buckets'
      and policyname = 'savings_buckets_select_own'
  ) then
    create policy savings_buckets_select_own
      on public.savings_buckets
      for select
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'savings_buckets'
      and policyname = 'savings_buckets_insert_own'
  ) then
    create policy savings_buckets_insert_own
      on public.savings_buckets
      for insert
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'savings_buckets'
      and policyname = 'savings_buckets_update_own'
  ) then
    create policy savings_buckets_update_own
      on public.savings_buckets
      for update
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'savings_buckets'
      and policyname = 'savings_buckets_delete_own'
  ) then
    create policy savings_buckets_delete_own
      on public.savings_buckets
      for delete
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'savings_contributions'
      and policyname = 'savings_contributions_select_own'
  ) then
    create policy savings_contributions_select_own
      on public.savings_contributions
      for select
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'savings_contributions'
      and policyname = 'savings_contributions_insert_own'
  ) then
    create policy savings_contributions_insert_own
      on public.savings_contributions
      for insert
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'savings_contributions'
      and policyname = 'savings_contributions_update_own'
  ) then
    create policy savings_contributions_update_own
      on public.savings_contributions
      for update
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'savings_contributions'
      and policyname = 'savings_contributions_delete_own'
  ) then
    create policy savings_contributions_delete_own
      on public.savings_contributions
      for delete
      using (user_id = auth.uid());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_savings_buckets_set_updated_at'
  ) then
    create trigger trg_savings_buckets_set_updated_at
      before update on public.savings_buckets
      for each row
      execute function public.set_updated_at();
  end if;
end
$$;

create or replace function public.savings_bucket_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_buckets jsonb := '[]'::jsonb;
  v_total_saved numeric := 0;
  v_total_brianna numeric := 0;
  v_total_elaine numeric := 0;
  v_total_household numeric := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  with active_buckets as (
    select
      sb.id as bucket_id,
      sb.name,
      sb.owner,
      sb.target_amount,
      sb.current_balance,
      sb.allocation_pct,
      sb.weekly_target,
      sb.goal_date,
      sb.priority,
      case
        when sb.target_amount is null or sb.target_amount = 0 then null
        else round(sb.current_balance / nullif(sb.target_amount, 0), 4)
      end as progress_pct,
      case
        when sb.target_amount is null then null
        when sb.weekly_target is null or sb.weekly_target <= 0 then null
        when sb.current_balance >= sb.target_amount then 0
        else ceil((sb.target_amount - sb.current_balance) / sb.weekly_target)::integer
      end as weeks_to_goal
    from public.savings_buckets sb
    where sb.user_id = v_user_id
      and sb.is_active = true
    order by sb.priority asc, sb.name asc
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bucket_id', bucket_id,
        'name', name,
        'owner', owner,
        'target_amount', target_amount,
        'current_balance', current_balance,
        'allocation_pct', allocation_pct,
        'weekly_target', weekly_target,
        'goal_date', goal_date,
        'priority', priority,
        'progress_pct', progress_pct,
        'weeks_to_goal', weeks_to_goal
      )
      order by priority asc, name asc
    ),
    '[]'::jsonb
  )
  into v_buckets
  from active_buckets;

  select
    coalesce(round(sum(sb.current_balance), 2), 0),
    coalesce(round(sum(case when sb.owner = 'brianna' then sb.current_balance else 0 end), 2), 0),
    coalesce(round(sum(case when sb.owner = 'elaine' then sb.current_balance else 0 end), 2), 0),
    coalesce(round(sum(case when sb.owner = 'household' then sb.current_balance else 0 end), 2), 0)
  into
    v_total_saved,
    v_total_brianna,
    v_total_elaine,
    v_total_household
  from public.savings_buckets sb
  where sb.user_id = v_user_id
    and sb.is_active = true;

  return jsonb_build_object(
    'buckets', v_buckets,
    'total_saved', v_total_saved,
    'total_by_owner', jsonb_build_object(
      'brianna', v_total_brianna,
      'elaine', v_total_elaine,
      'household', v_total_household
    )
  );
end;
$$;

revoke all on function public.savings_bucket_summary() from public;
grant execute on function public.savings_bucket_summary() to authenticated;
