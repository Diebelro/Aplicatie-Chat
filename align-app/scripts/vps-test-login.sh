#!/usr/bin/env bash
# Test login local pe VPS (port 3002). Credențialele vin DIN MEDIU — nu din fișier.
# Exemplu:
#   TEST_LOGIN_EMAIL='...' TEST_LOGIN_PASSWORD='...' bash scripts/vps-test-login.sh
set -euo pipefail

if [ -z "${TEST_LOGIN_EMAIL:-}" ] || [ -z "${TEST_LOGIN_PASSWORD:-}" ]; then
  echo "Setează TEST_LOGIN_EMAIL și TEST_LOGIN_PASSWORD. Nu pune parole în script." >&2
  exit 1
fi

url="${TEST_LOGIN_URL:-http://127.0.0.1:3002/api/auth/login}"

if command -v python3 >/dev/null 2>&1; then
  payload=$(TEST_LOGIN_EMAIL="$TEST_LOGIN_EMAIL" TEST_LOGIN_PASSWORD="$TEST_LOGIN_PASSWORD" python3 -c \
    'import json,os; print(json.dumps({"email":os.environ["TEST_LOGIN_EMAIL"],"password":os.environ["TEST_LOGIN_PASSWORD"]}))')
else
  echo "python3 este necesar pentru a trimite JSON în siguranță." >&2
  exit 1
fi

curl -s -X POST "$url" \
  -H 'Content-Type: application/json' \
  --data "$payload"
echo
