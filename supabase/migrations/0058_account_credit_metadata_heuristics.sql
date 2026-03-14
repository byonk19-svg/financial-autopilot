-- Some providers label credit cards with a generic account type like "other".
-- Keep is_credit DB-derived, but fall back to account metadata so dashboard
-- spend queries continue to classify real card purchases correctly.

create or replace function public.derive_account_is_credit_from_metadata(
  account_type text,
  account_name text,
  institution text
)
returns boolean
language sql
immutable
as $$
  with normalized as (
    select
      coalesce(lower(account_type), '') as type_value,
      coalesce(lower(account_name), '') as name_value,
      coalesce(lower(institution), '') as institution_value
  )
  select
    type_value ~ '(credit|charge)'
    or (
      type_value !~ '(checking|savings|debit|broker|invest|retire|loan|mortgage)'
      and name_value !~ '(checking|savings|debit|broker|invest|retire|loan|mortgage)'
      and (
        name_value ~ '(^|[^a-z])(visa|mastercard|master card|amex|american express|discover)([^a-z]|$)'
        or name_value ~ '(credit card|rewards visa|blue cash|prime visa|quicksilver|sapphire|freedom)'
        or institution_value ~ '(american express|amex)'
      )
    )
  from normalized;
$$;

create or replace function public.set_account_is_credit_from_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.is_credit := public.derive_account_is_credit_from_metadata(new.type, new.name, new.institution);
  return new;
end;
$$;

drop trigger if exists trg_accounts_set_is_credit_from_type on public.accounts;
create trigger trg_accounts_set_is_credit_from_type
  before insert or update of type, name, institution
  on public.accounts
  for each row
  execute function public.set_account_is_credit_from_type();

update public.accounts a
   set is_credit = public.derive_account_is_credit_from_metadata(a.type, a.name, a.institution)
 where a.is_credit is distinct from public.derive_account_is_credit_from_metadata(a.type, a.name, a.institution);

update public.transactions t
   set is_credit = a.is_credit
  from public.accounts a
 where a.id = t.account_id
   and t.is_credit is distinct from a.is_credit;
