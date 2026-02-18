-- Drop legacy SimpleFIN encrypted token columns after verifying token_enc backfill coverage.

do $$
declare
  missing_token_count integer;
begin
  select count(*)
    into missing_token_count
  from public.bank_connections
  where token_enc is null;

  if missing_token_count > 0 then
    raise exception
      'Cannot drop legacy SimpleFIN columns: % row(s) in public.bank_connections still have null token_enc.',
      missing_token_count
      using hint = 'Backfill token_enc for all bank_connections rows before running this migration.';
  end if;
end
$$;

alter table public.bank_connections
  drop column if exists access_url_iv,
  drop column if exists access_url_ciphertext;
