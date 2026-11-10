# GitHub repository and controlled deployment

Target GitHub repository: `https://github.com/shabani-alfani/dash-questionare.git`

## 1. Push from the developer's Mac

Download `dash-questionare-github-ready.zip` to `~/Downloads/`. The safest approach is to **clone the existing remote first** (works even if GitHub already created a README commit):

```bash
cd ~/Downloads
unzip -q dash-questionare-github-ready.zip -d dash-questionare-release
cd ~/Projects
git clone https://github.com/shabani-alfani/dash-questionare.git dash-questionare
rsync -av --exclude='.git' ~/Downloads/dash-questionare-release/ dash-questionare/
cd dash-questionare
npm run check && npm test
git status --short
# Confirm .env and .private-cache are NOT shown.
git add .
git commit -m "Release Kobo multi-form dashboard with secure local sync"
git push -u origin HEAD:main
```

If the `~/Projects` directory does not exist, create it first with `mkdir -p ~/Projects`. If you already have a local clone, **use it rather than cloning again**: inspect `git status`, back up uncommitted changes and copy reviewed release files to that clone.

Do **not** use `git push --force`. Use GitHub authentication through the credential manager or an approved personal access token stored in the credential manager; never paste a token into the URL. If the branch is protected or permission is denied, create an approved pull request rather than bypassing controls.

## 2. Local Mac run

```bash
cp .env.example .env
chmod 600 .env
# Edit .env with the approved Kobo read-only token and strong dashboard credentials.
./scripts/run-local.sh --sync-once
./scripts/run-local.sh
```

Use `http://127.0.0.1:18072` (Basic Auth). No permanent server access is necessary for laptop development.

## 3. Existing `elimu.moe.go.tz:8072` server — risk-controlled code deployment

The existing analytics service is `kobo-school-analytics` in `/var/www/html/kobo-analytics-8072`, behind HTTPS :8072 and loopback port 18072. Kobo production collection services are on a different machine and **must not be restarted**.

Before any change: confirm the exact SSH host, application path, runtime user and environment file. Review the `git diff` of the new release; do not overwrite the existing production directory merely because the names are similar.

Recommended low-risk rollout:

1. Clone the new repository into a **separate staging directory** on the analytics host (not inside the live directory).
2. Run `npm run check && npm test` against staging; no `.env` or local cache is present in Git.
3. Compare staging files to the current live directory. Preserve `/etc/kobo-school-analytics/dashboard.env`, systemd unit and existing Nginx vhost.
4. Save a verified timestamped backup of the live code before any deployment.
5. During an approved maintenance window, deploy **only reviewed code**; restart only `kobo-school-analytics`, not Kobo/Enketo/PostgreSQL/Redis/Nginx.
6. Verify `/api/dashboard/health`, `/api/multiform/list`, real form totals and attachment access. Stop/revert if counts unexpectedly drop or source permissions fail.

### Safe read-only preflight on analytics host

```bash
hostname -f
ip -br -4 addr
sudo systemctl status kobo-school-analytics --no-pager
sudo test -s /var/www/html/kobo-analytics-8072/server.js
sudo test -s /etc/kobo-school-analytics/dashboard.env
sudo ls -l /var/www/html/kobo-analytics-8072
sudo ss -lntp | grep ':18072' || true
free -h; df -h /
```

Do not use GitHub Actions auto-deploy, unattended `git pull`, root-run application, or GitHub credentials stored on the server for this production government dashboard without an approved change process.

## 4. Rollback strategy

Preserve the original service configuration and the exact backup archive before replacement. If verification fails, restore reviewed previous code from the backup and restart **only** `kobo-school-analytics`; do not change Kobo Production. Ensure the backup is a valid archive and not placed in Git.

## 5. Access and security

Consider repository visibility and authorization carefully: official questionnaire schema, school directories, network topology and deployment references may be sensitive even when respondent rows are omitted. Use a **private repository** unless release is explicitly authorized. Do not include API tokens, credentials, raw response JSON, screenshots of PII or encryption keys in issues/commits.
