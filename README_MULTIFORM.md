# Kobo Analytics Multi-Questionnaire Upgrade (elimu.moe.go.tz:8072)

**Release:** 2026-11-03 · **Node.js:** 22.x (no npm packages) · **Nginx:** unchanged · **Kobo production:** read-only.

The current deployed dashboard for **Dodoso la Mkuu wa Shule** is preserved. This release adds a questionnaire selector and complete, scrollable analytics for all five surveys.

| ID | Survey | Kobo asset UID | Source supplied for question mapping |
|---|---|---|---|
| mkuu | Dodoso la Mkuu wa Shule | `aStHVYV5gmRm6Jt7yLGgzs` | Existing dashboard schema (453 exported columns including metadata) |
| tathmini | Tathmini Uthibiti Ubora | `aFK5gEpN2AJjQVgCwkfg6q` | XLSForm, 404 data/calculated fields, 59 groups, 54 notes |
| uthibiti | Uthibiti Ubora | `aie9G5dmPonMUx9M4fnPsa` | XLSForm, 321 data/calculated fields, 75 groups, 19 notes, 2 repeats |
| mwalimu | Dodoso la Mwalimu | `aPUUjowQKFCSHKtFDTTcbX` | Kobo Excel export: 214 columns, `i_challenges` repeat |
| picha | Dodoso la Picha | `aspBZT4nWvzi8osSG4y2RP` | Kobo Excel export: 39 columns and photo attachment columns |

Data-export source workbooks are **not included** in the distributed kit; no personal respondent data are bundled. For the teacher and photo surveys, the server fetches the authoritative questionnaire labels, types, groups, and choices from Kobo API when permitted. For the two XLSForms it merges API metadata with the supplied XLSForm to preserve all supplied question definitions. Raw keys from live submissions are appended to the schema if not declared, so data columns are not silently dropped.

## Features

- **Dropdown above the questionnaire heading** to switch between the 5 Kobo projects.
- **Executive Overview** with submissions, regions, fields, and repeat records.
- **Full Geographic Lists**: Mkoa, Halmashauri/Wilaya, Kata, village/mtaa/kitongoji from repeat tables where captured, and Shule; filtered lists, search, and CSV export.
- **Scrollbars on card distributions**, with **View full list** for all values, including the first-to-last school.
- **Complete Question Explorer**: all questions, groups, notes, calculated fields and API fields; search by label/path, group dropdown, pagination, and View Full List.
- **Question Detail** for every field: filled/blank-or-not-applicable counts, coded choice labels where metadata is available, frequency of all answers, numeric sum/mean/min/max with interpretation caveat, and complete answer table with search, paging or View Full List.
- **All Submissions**: filterable record register and an authenticated full record view.
- **Repeat Group Analytics**: every repeat table and its child fields/rows with full lists; calculated counts are tied to the filtered parent submissions.
- **Photographic Evidence**: counts and explicit per-submission thumbnails fetched through a scoped authenticated Kobo proxy. No Kobo API token enters browser JavaScript.
- **Data Quality**: field-level completeness/coverage with skip-logic caution.
- **Legacy headteacher pages kept intact**: original A–L module analytics, existing 7 repeat pages and existing filtering remain accessible when the first survey is selected. New generic all-field and geographical views are also available from its sidebar.

## Important limitations / governance

1. The API token currently proven for Headteacher **may not be authorized for all other assets**. For each form with HTTP 401/403, grant read access or populate a dedicated read-only per-form token (`KOBO_TOKEN_TATHMINI`, `KOBO_TOKEN_UTHIBITI`, `KOBO_TOKEN_MWALIMU`, `KOBO_TOKEN_PICHA`) inside `/etc/kobo-school-analytics/dashboard.env`, then restart **only** `kobo-school-analytics`. Never paste real tokens into a shared chat or shell history.
2. Counts cover **submitted records** only, not all schools in Tanzania. Official response rates require a verified school or respondent denominator and registration-number deduplication.
3. Blank answers may result from skip logic, a calculated field, a non-applicable section or genuine missing data. Zero values are not treated as blank.
4. Not every questionnaire collects Mkoa, Wilaya, Kata, Vijiji or Shule; the UI shows `Hakuna data` when a requested geographic level is not captured. Villages may be stored only in a repeat group.
5. Some photo attachments may not be downloadable even if metadata is accessible; this is an authorization/storage issue. Never expose the Kobo API token or direct attachment links publicly.
6. `MAX_SUBMISSIONS=10000` is enforced **per form**, and if the count exceeds it the next sync fails with a visible error; no silent truncation. Raise the limit with capacity review before any form exceeds it.
7. This release is read-only with **full reconciliation polling**, normally every 300 seconds; it does not modify, delete or acknowledge Kobo submissions. Five-project polling increases reads on the Kobo API; monitor CPU/memory/HTTP availability and adjust polling if necessary.
8. Basic Auth is present, but it is not per-role audit-grade RBAC. Restrict port 8072 via firewall/VPN, use strong credentials, and consider SSO, audit trails and per-user permissions for leadership-scale access.
9. The 4 additional surveys have not been queried against the **real production Kobo API** during package creation, because tokens remain on your server. Counts and dynamic mapping must be verified on the deployed server. UI tests used *synthetic mock submissions* only.

See `DEPLOY_MULTIFORM_UPGRADE.md` for stage/backup/install/test/rollback instructions. Nginx and `/etc/kobo-school-analytics/dashboard.env` are not overwritten by the update process.
