#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ ! -f .env ]]; then
  echo "Missing .env. Copy .env.example to .env and configure credentials locally." >&2
  exit 1
fi
# Built-in Node.js env-file parser: passwords containing $, # and ! remain literal when quoted.
node --env-file=.env -e '
for (const name of ["KOBO_API_TOKEN", "DASHBOARD_USER", "DASHBOARD_PASSWORD"]) {
  const value = process.env[name] || "";
  if (!value.trim() || value.startsWith("PUT_") || value.startsWith("REPLACE_")) {
    console.error("Missing or placeholder setting: " + name);
    process.exitCode = 1;
  }
}
'
exec node --env-file=.env server.js "$@"
