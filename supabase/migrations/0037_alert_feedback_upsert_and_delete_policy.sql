-- Enable correction-friendly alert feedback by enforcing one row per
-- (user_id, alert_type, merchant_canonical), plus delete/update permissions.

-- Remove legacy duplicates, keeping the latest feedback per key.
with ranked as (
  select
    ctid,
    row_number() over (
      partition by user_id, alert_type, merchant_canonical
      order by created_at desc
    ) as row_num
  from public.alert_feedback
)
delete from public.alert_feedback af
using ranked
where af.ctid = ranked.ctid
  and ranked.row_num > 1;

create unique index if not exists uq_alert_feedback_user_type_merchant
on public.alert_feedback (user_id, alert_type, merchant_canonical);

drop policy if exists alert_feedback_update_own on public.alert_feedback;
create policy alert_feedback_update_own
  on public.alert_feedback
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists alert_feedback_delete_own on public.alert_feedback;
create policy alert_feedback_delete_own
  on public.alert_feedback
  for delete
  using (user_id = auth.uid());
