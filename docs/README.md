# Docs

## Weekly Insights

### Database migration

```powershell
supabase db push
```

This applies:

- `supabase/migrations/0005_insights.sql` for `public.insights`
- `supabase/migrations/0006_generate_weekly_insights_schedule.sql` for the weekly cron job

### Deploy function

```powershell
supabase functions deploy generate-weekly-insights
```

### Required edge secrets

```powershell
supabase secrets set CRON_SECRET="YOUR_CRON_SECRET_VALUE"
```

### Schedule

The migration schedules `generate-weekly-insights` at `0 2 * * 1` (UTC), which is:

- Sunday 8:00 PM CST (winter)
- Sunday 9:00 PM CDT (summer)

Scheduler HTTP calls read `project_url` and `cron_secret` from `private.scheduler_secrets`.

### Verify jobs

```sql
select * from cron.job;
select * from cron.job_run_details order by start_time desc limit 20;
```

## SimpleFIN Credential Encryption At Rest

SimpleFIN credentials are stored in `public.bank_connections` using:

- `token_enc bytea`: serialized encrypted payload bytes (AES-GCM ciphertext + IV envelope)
- `token_kid text`: key version used to encrypt that row

Legacy columns (`access_url_ciphertext`, `access_url_iv`) are still written for backward compatibility, but new reads prefer `token_enc`.

### Required secrets

```powershell
supabase secrets set SIMPLEFIN_ENC_KEY="YOUR_ACTIVE_32+_CHAR_KEY"
supabase secrets set SIMPLEFIN_ENC_KID="v1"
```

Optional keyring for decrypting older rows after rotation:

```powershell
supabase secrets set SIMPLEFIN_ENC_KEYS_JSON="{\"v1\":\"old_key_here\",\"v2\":\"new_key_here\"}"
```

Notes:

- `SIMPLEFIN_ENC_KEY` + `SIMPLEFIN_ENC_KID` is the active encrypt key pair.
- `SIMPLEFIN_ENC_KEYS_JSON` is used as a decrypt keyring by `token_kid`.
- Active key pair is always injected into the keyring at runtime.

### Migration and deploy

```powershell
supabase db push
supabase functions deploy simplefin-connect
supabase functions deploy simplefin-sync
```

### Key rotation process (kid/version)

1. Generate a new key and choose a new kid (example: `v2`).
2. Set secrets:
   - `SIMPLEFIN_ENC_KEY=<new key>`
   - `SIMPLEFIN_ENC_KID=v2`
   - `SIMPLEFIN_ENC_KEYS_JSON` includes both old and new keys.
3. Deploy `simplefin-connect` and `simplefin-sync`.
4. Reconnect accounts or run a re-encryption pass so rows move to `token_kid='v2'`.
5. After all rows are rotated, remove old keys from `SIMPLEFIN_ENC_KEYS_JSON`.
