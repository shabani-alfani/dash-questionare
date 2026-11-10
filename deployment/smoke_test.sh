#!/usr/bin/env bash
set -euo pipefail
# Read-only application check (authenticated).
BASE="${1:-http://127.0.0.1:5080}"
USER="${DASHBOARD_USER:-internal_dashboard_admin}"
read -rsp 'Dashboard password: ' PASS; echo
curl --fail-with-body --silent --show-error --max-time 30 \
  -u "$USER:$PASS" "$BASE/api/dashboard/health" | python3 -m json.tool
unset PASS
