# Dash Questionare — Kobo Multi-Questionnaire Analytics

**Release:** 1.1.0 · Original dashboard preserved + Git-ready local API sync improvements.

This is the **existing Node.js dashboard** built earlier for `elimu.moe.go.tz:8072`, with the complete Multi-Form v5 UI preserved. It is **not** the separate Laravel project created on a developer's local machine. To merge into that Laravel application, the Laravel repository source is needed.

## Five Kobo assets

| Form | Asset UID |
|---|---|
| Mkuu wa Shule | `aStHVYV5gmRm6Jt7yLGgzs` |
| Tathmini ya Uthibiti Ubora | `aFK5gEpN2AJjQVgCwkfg6q` |
| Uthibiti Ubora | `aie9G5dmPonMUx9M4fnPsa` |
| Dodoso la Mwalimu | `aPUUjowQKFCSHKtFDTTcbX` |
| Dodoso la Picha | `aspBZT4nWvzi8osSG4y2RP` |

## Current features

- Original Mkuu wa Shule executive dashboard and legacy analytical modules.
- Multi-form selector, dynamic Question Explorer, per-field statistics, records, repeat tables, district/ward/school filters, downloadable CSV and photo gallery.
- Kobo API v2 read-only synchronization with pagination, URL allowlisting, request pacing and retry for transient errors.
- Forms synchronized **sequentially**, not five simultaneous full downloads.
- Optional **AES-256-GCM encrypted local cache** for offline data availability. No raw submissions or tokens in this Git repository.
- Local Mac/Linux development mode, one-time synchronization CLI, GitHub Actions code/test checks (no auto-deployment).
- Baseline schema definitions included; live records are downloaded only after configuring an authorized Kobo API token.

## Local setup (macOS / Ubuntu)

Node.js 22 LTS recommended; no `npm install` required.

```bash
cp .env.example .env
chmod 600 .env
# Edit .env locally: read-only token and strong DASHBOARD_PASSWORD.
# Generate a 64-hex KOBO_CACHE_KEY and set it in .env before --sync-once:
# openssl rand -hex 32
./scripts/run-local.sh --sync-once
./scripts/run-local.sh
```

Visit `http://127.0.0.1:18072/` and enter the dashboard Basic Auth credentials from `.env`.

- `--sync-once`: requires KOBO_CACHE_KEY, downloads all five Kobo asset datasets sequentially, saves encrypted snapshots, and exits. It returns a nonzero exit status if a form fails.
- Default local polling interval is **1800 seconds** (30 min), intentionally conservative for the Kobo Production server.
- `KOBO_PAGE_SIZE=100`, `KOBO_REQUEST_DELAY_MS=1250` and `MAX_SUBMISSIONS=10000` provide back-pressure. Adjust only after load review.
- `KOBO_CACHE_KEY`: optional 64-hex secret. When present, all five survey datasets are saved only as encrypted records under `.private-cache/` (0700 directory, 0600 files). Store/backup the key securely. Losing it makes cached files unreadable.
- With caching disabled, all API data stays in process memory and a restart requires a new sync.
- A `503` for a form without previous data means the Kobo endpoint was not reachable/authorized; a form restored from cache stays marked `cached`/`stale` until a fresh successful sync.
- Attachments are fetched on-demand via an authenticated backend endpoint; image bytes are not bundled in the repository.

## Security

This dashboard handles sensitive questionnaire submissions. **Never commit** `.env`, `.private-cache`, tokens, real exports, personal data or backup archives. Git does not store runtime submissions. Use a dedicated Kobo user with the minimum required read permissions. All API calls are GET only. Keep this dashboard on loopback behind authenticated TLS if exposed remotely; Basic Auth is not a substitute for a full per-user RBAC/audit model. Do not host this repository via a static public GitHub Pages site.

CI only checks syntax and unit tests. There is deliberately **no GitHub Action that deploys to government servers**.

## Project and deployment documentation

- [`README_LOCAL.md`](README_LOCAL.md) — local tests, troubleshooting, incremental operation.
- [`DEPLOY_GITHUB.md`](DEPLOY_GITHUB.md) — GitHub push and controlled target-host deployment.
- [`README_MULTIFORM.md`](README_MULTIFORM.md) — per-form analytics features and caveats.
- [`DEPLOY_8072.md`](DEPLOY_8072.md) and other legacy deployment references are retained for history; follow `DEPLOY_GITHUB.md` for this release.

## Tests

```bash
npm run check
npm test
```

## Known limits

The original dashboard pulls complete datasets during a sync, rather than incremental row-level updates. For very large datasets, implement a relational storage/indexed incremental sync in the **Laravel application source**, once available; do not increase the API polling rate to compensate. No production API/token was available during this build, so all five live pulls need verification on a machine with authorized access.
