# E2E Tests (Playwright)

## Smoke tests (no auth required)

```powershell
npm.cmd run test:e2e
```

Current coverage in `test:e2e`:
- Login page shell renders
- Unauthenticated redirects for Transactions and Recurring
- Authenticated flow spec is included but auto-skips without auth setup

## Authenticated flow (real app actions)

This suite covers:
- Login (if needed)
- `Accounts` -> `Sync now`
- `Rules` -> `Run analysis now`
- `Recurring` page load check
- `Transactions` pending filter default behavior (`is_pending=eq.false` by default)
- Split recurring merchants render as separate rows (mocked recurring payload)

### Option A: credentials

Set env vars in your PowerShell session:

```powershell
$env:PLAYWRIGHT_EMAIL = "your-email@example.com"
$env:PLAYWRIGHT_PASSWORD = "your-password"
npm.cmd run test:e2e:auth:setup
npm.cmd run test:e2e:auth
```

### Option B: storage state file

If you already have a saved Playwright auth state JSON (or you generated one):

```powershell
$env:PLAYWRIGHT_AUTH_STATE = "C:\\path\\to\\auth-state.json"
npm.cmd run test:e2e:auth
```

### Option C: manual browser login (no env creds)

```powershell
npm.cmd run test:e2e:auth:setup
npm.cmd run test:e2e:auth
```

The setup command opens a browser on `/login`, waits for you to sign in, then saves `.auth/user.json`.

## Notes

- Authenticated tests call real APIs and can take up to a few minutes.
- They will fail if bank connection/session is invalid.
