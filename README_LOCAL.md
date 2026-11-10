# Local integration and diagnostics

## Prerequisites
- macOS or Linux with Node.js >= 20.6 (22 recommended)
- Outbound HTTPS access to `kpi.esmis.moe.go.tz` and an approved read-only Kobo API token with access to all five assets
- A password for the local dashboard UI

## First start

```bash
cp .env.example .env
chmod 600 .env
# Edit .env in the terminal without pasting credentials in the chat.
# On macOS, use: nano .env
openssl rand -hex 32  # Set the output as KOBO_CACHE_KEY in .env before --sync-once
./scripts/run-local.sh --sync-once
./scripts/run-local.sh
```

Use a different port if 18072 is already occupied: edit `PORT` in `.env`. Host defaults to `127.0.0.1`; do not bind to `0.0.0.0` without approved access controls.

### Non-sensitive API connectivity test

```bash
read -rsp 'Kobo API token: ' KOBO_TOKEN; echo
curl --connect-timeout 5 --max-time 30 -sS -o /dev/null \
  -H "Authorization: Token $KOBO_TOKEN" \
  -w 'HTTP=%{http_code} TIME=%{time_total}s\n' \
  'https://kpi.esmis.moe.go.tz/api/v2/assets/aStHVYV5gmRm6Jt7yLGgzs/data/?limit=1'
unset KOBO_TOKEN
```

`200` means the first asset is reachable. `401`/`403` indicate token or asset permissions; `429` requires backing off; `5xx` requires checking source application health, not restarting the local dashboard repeatedly.

### Local endpoint tests

```bash
curl -u local_admin -sS http://127.0.0.1:18072/api/dashboard/health | python3 -m json.tool
curl -u local_admin -sS http://127.0.0.1:18072/api/multiform/list | python3 -m json.tool
```

`curl -u local_admin` prompts securely for the password. Never put the password directly in command arguments or Git history.

## Local data governance

- Raw Kobo submissions may contain identifying information. Encryption-at-rest of local cache is optional and must be enabled explicitly via `KOBO_CACHE_KEY` before allowing offline persistence.
- `.private-cache` is gitignored, and the encrypted cache files cannot be read without the key.
- Do not share a local cache ZIP or commit it to Git. Only the static schema and source files belong in the repository.
- `npm test` uses synthetic records and never queries Production.

## Operational behavior

- On startup, a cache (if configured) is restored, marked stale, and new sync starts.
- Forms are synchronized serially, and failed pulls do not erase the prior successful dataset.
- `MAX_SUBMISSIONS` failure prevents incomplete data from appearing as official totals.
- The dashboard is in-memory during operation; full source pulls across five forms may use substantial RAM on a developer laptop.
- Dashboard health indicates data freshness. Submission acceptance on Kobo Production is independent and must be monitored separately.
