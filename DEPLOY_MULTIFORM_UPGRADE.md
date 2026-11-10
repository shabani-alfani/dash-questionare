# Production-safe upgrade — Kobo Analytics 8072 (shared / elimu.moe.go.tz)

## 0) Transfer from Mac

Save `Kobo_Analytics_Elimu_8072_MultiForm_Upgrade.zip` to `/Users/dba/Downloads/`, then:

```bash
scp -P 22 -C \
  /Users/dba/Downloads/Kobo_Analytics_Elimu_8072_MultiForm_Upgrade.zip \
  shabani.alfani@elimu.moe.go.tz:/home/shabani.alfani/

ssh -p 22 shabani.alfani@elimu.moe.go.tz
```

No commands below are intended for `kpi.esmis.moe.go.tz`; that Kobo server is **not touched**.

## 1) Preflight / stage files (read-only)

```bash
set -e
PROJECT=/var/www/html/kobo-analytics-8072
ZIP=/home/shabani.alfani/Kobo_Analytics_Elimu_8072_MultiForm_Upgrade.zip
STAGE=$(mktemp -d /tmp/kobo-mf-stage.XXXXXX)

sudo systemctl is-active --quiet kobo-school-analytics
sudo ss -lntp | grep ':18072'
test -s "$ZIP"
unzip -t "$ZIP" | tail -2
unzip -q "$ZIP" -d "$STAGE"

for file in server.js index.html multiform.js multiform.css multiform_backend.js survey_catalog.json; do
    test -s "$STAGE/$file" || { echo "MISSING $file"; exit 1; }
done

/usr/local/bin/node --check "$STAGE/server.js"
/usr/local/bin/node --check "$STAGE/multiform.js"
/usr/local/bin/node --check "$STAGE/multiform_backend.js"

echo "Staged successfully at: $STAGE"
```

If a preflight fails, **stop**. Do not proceed to updating live files.

## 2) Root-protected rollback backup

```bash
BACKUP_DIR=/var/backups/kobo-school-analytics
STAMP=$(date +%Y%m%d_%H%M%S)
BACKUP="$BACKUP_DIR/kobo_8072_before_multiform_$STAMP.tgz"

sudo install -d -o root -g root -m 0700 "$BACKUP_DIR"
sudo tar -C /var/www/html -czf "$BACKUP" kobo-analytics-8072
sudo chmod 0600 "$BACKUP"
sudo tar -tzf "$BACKUP" | head -15
printf 'ROLLBACK_BACKUP=%s\n' "$BACKUP"
```

Keep the exact `ROLLBACK_BACKUP` path for rollback. The archive does not contain the secret environment file, which is stored outside the project and is not being modified by this upgrade.

## 3) Install exactly six changed files (no Nginx / service-unit / .env changes)

```bash
PROJECT=/var/www/html/kobo-analytics-8072

for file in server.js index.html multiform.js multiform.css multiform_backend.js survey_catalog.json; do
    sudo install -o root -g kobo-analytics -m 0640 \
      "$STAGE/$file" "$PROJECT/$file"
done

for file in server.js index.html multiform.js multiform.css multiform_backend.js survey_catalog.json; do
    sudo -u kobo-analytics test -r "$PROJECT/$file" || exit 1
done

sudo systemctl restart kobo-school-analytics
sudo systemctl status kobo-school-analytics --no-pager
```

The restart briefly interrupts **this dashboard only**. Kobo data collection and existing Nginx/Laravel apps are unaffected.

## 4) Verify all five project statuses

```bash
sudo ss -lntp | grep ':18072'

curl -sS -o /dev/null -w 'NO AUTH: %{http_code}\n' \
  http://127.0.0.1:18072/api/multiform/list
# Expected: 401.

curl --fail-with-body -sS -u internal_dashboard_admin \
  http://127.0.0.1:18072/api/multiform/list \
  | python3 -m json.tool
```

The Headteacher form should be online quickly. The other four are read sequentially, starting after the original Headteacher sync. An initial pending status is not necessarily an error. If there is an `HTTP 403` or `HTTP 401` error for a particular survey, follow step 5. Do not claim that a survey with `online: false` has zero submissions.

Verify HTTPS and original compatibility:

```bash
curl --fail-with-body -sS -u internal_dashboard_admin \
  https://elimu.moe.go.tz:8072/api/dashboard/health \
  | python3 -m json.tool

curl --fail-with-body -sS -u internal_dashboard_admin \
  https://elimu.moe.go.tz:8072/api/multiform/list \
  | python3 -m json.tool

sudo journalctl -u kobo-school-analytics -n 80 --no-pager
```

Open `https://elimu.moe.go.tz:8072`, use the existing dashboard Basic Auth account, and test all dropdown choices. Important: verify each form's question count against Kobo forms and any exported XLSForm; verify region/halmashauri/school category counts and a few repeat relationships.

## 5) Optional: per-form read-only tokens

A token authorized for the original Headteacher form may not have rights to other Kobo assets. Prepare a read-only token for the missing asset, then run:

```bash
sudoedit /etc/kobo-school-analytics/dashboard.env
```

Add the applicable lines without removing existing credential settings:

```dotenv
KOBO_TOKEN_TATHMINI=...
KOBO_TOKEN_UTHIBITI=...
KOBO_TOKEN_MWALIMU=...
KOBO_TOKEN_PICHA=...
```

Use a distinct valid Kobo token only when needed. Ensure `root:root 0600` for the file. Then restart only the dashboard:

```bash
sudo chmod 0600 /etc/kobo-school-analytics/dashboard.env
sudo systemctl restart kobo-school-analytics
```

Never send the full `.env` file or bearer tokens into chat.

## 6) Rollback (only if required)

Confirm the exact backup path from step 2 (replace the example path below). Do not use the latest backup blindly when other deployments have occurred.

```bash
BACKUP='/var/backups/kobo-school-analytics/kobo_8072_before_multiform_YYYYmmdd_HHMMSS.tgz'
test -n "$BACKUP" && sudo test -f "$BACKUP" || exit 1

sudo systemctl stop kobo-school-analytics
sudo tar -xzf "$BACKUP" -C /var/www/html
sudo systemctl start kobo-school-analytics
sudo systemctl status kobo-school-analytics --no-pager

curl -sS -o /dev/null -w 'Old backend auth: %{http_code}\n' \
  http://127.0.0.1:18072/
# Expected: 401.
```

The six new files may remain on disk; they are not referenced by the restored original `index.html` and `server.js`. No deletion or modification to Kobo production, SSL, Nginx or other services is required.
