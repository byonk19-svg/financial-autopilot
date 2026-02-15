-- Seed recurring classification rules from currently locked subscription rows.
-- Safe to rerun: uses ON CONFLICT against uq_recurring_classification_rules_match.

with locked_rows as (
  select
    s.user_id,
    s.merchant_normalized,
    s.cadence,
    s.classification,
    case
      when s.last_amount is not null and s.last_amount > 0
        then round(greatest(0, s.last_amount - greatest(2, s.last_amount * 0.10))::numeric, 2)
      else null
    end as min_amount,
    case
      when s.last_amount is not null and s.last_amount > 0
        then round((s.last_amount + greatest(2, s.last_amount * 0.10))::numeric, 2)
      else null
    end as max_amount
  from public.subscriptions s
  where s.is_active = true
    and s.user_locked = true
    and s.classification in ('subscription', 'bill_loan', 'transfer', 'ignore')
)
insert into public.recurring_classification_rules (
  user_id,
  merchant_normalized,
  cadence,
  min_amount,
  max_amount,
  classification,
  is_active
)
select
  l.user_id,
  l.merchant_normalized,
  l.cadence,
  l.min_amount,
  l.max_amount,
  l.classification,
  true
from locked_rows l
on conflict (user_id, merchant_normalized, coalesce(cadence, ''), coalesce(min_amount, -1), coalesce(max_amount, -1), classification)
do update
set
  is_active = true,
  updated_at = timezone('utc', now());
