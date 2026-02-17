-- Store SimpleFIN access credentials in rotation-ready encrypted-at-rest columns.
-- token_enc stores serialized encrypted payload bytes, token_kid stores key version used for encryption.

alter table public.bank_connections
add column if not exists token_enc bytea null,
add column if not exists token_kid text;

update public.bank_connections
set token_kid = coalesce(token_kid, concat('v', greatest(coalesce(enc_version, 1), 1)::text))
where token_kid is null;

alter table public.bank_connections
alter column token_kid set default 'v1';

-- Backfill from legacy encrypted fields without decrypting payload.
-- Legacy envelope format in bytea is: "<ivB64>:<ciphertextB64>".
update public.bank_connections
set token_enc = convert_to(access_url_iv || ':' || access_url_ciphertext, 'UTF8')
where token_enc is null
  and access_url_iv is not null
  and access_url_ciphertext is not null;

create index if not exists idx_bank_connections_provider_status_user
  on public.bank_connections (provider, status, user_id);

