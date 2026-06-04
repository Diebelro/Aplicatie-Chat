#!/usr/bin/env bash
# Rulează PE VPS: bash scripts/vps-grant-admin.sh contact@diebel.ro
set -euo pipefail
EMAIL="${1:-}"
if [[ -z "$EMAIL" || "$EMAIL" != *"@"* ]]; then
  echo "Folosire: bash scripts/vps-grant-admin.sh <email>"
  exit 1
fi
cd "$(dirname "$0")/.."
docker compose exec -T app node --input-type=module -e "
import { PrismaClient } from '@prisma/client';
const email = $(printf '%s' "$EMAIL" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))');
const p = new PrismaClient();
const r = await p.user.updateMany({ where: { email }, data: { role: 'ADMIN' } });
console.log(r.count ? 'OK: ADMIN pentru ' + email : 'EROARE: nu există user cu acest email');
await p.\$disconnect();
process.exit(r.count ? 0 : 1);
"
