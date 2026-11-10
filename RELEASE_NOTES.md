# Release v1.1.0 — Git-ready local Kobo integration

- Retains the full original dashboard and Multi-Form v5 analytics UI.
- Adds read-only Kobo API client with same-origin pagination, short bounded HTTP retries for 429/5xx and request pacing.
- Sequences sync of five surveys, avoiding a simultaneous five-form full pull.
- Adds optional AES-256-GCM encrypted local cache, offline restoration and stale/cached status.
- Adds local one-shot sync command, `npm run check`, `npm test` and GitHub Actions CI.
- Provides `.env.example`, Git `.gitignore`, GitHub deployment and safe rollback documentation.
- Does not include Kobo data, credentials, actual respondent records, a Laravel application, or GitHub remote commits.
- Live Kobo sync must be validated with an authorized token. No live external calls were performed during package construction.
