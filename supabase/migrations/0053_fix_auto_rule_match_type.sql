-- Fix auto-generated rules created by "Fix everywhere" and "Hide everywhere" that were
-- incorrectly set to match_type='equals'. The rules engine compares the pattern against
-- a concatenated haystack of all merchant fields, so 'equals' never matched anything.
-- Patch all auto-generated rules to 'contains'.

update public.transaction_rules
set match_type = 'contains'
where match_type = 'equals'
  and (
    name like 'Auto category:%'
    or name like 'Hide:%'
  );
