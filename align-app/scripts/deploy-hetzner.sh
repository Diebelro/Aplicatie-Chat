#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Diebel Chat — deploy de pe PC pe Hetzner (chat.diebel.ro), o singură comandă:
#   npm run deploy:hetzner
# Pași: tsc → sincronizare sursă (fără node_modules/.next/.env*) → pe server:
#   backup → build → up → health check → rollback automat (deploy/hetzner-deploy.sh)
# ----------------------------------------------------------------------------
set -euo pipefail
HOST="${DEPLOY_HOST:-root@178.104.2.31}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/root/Aplicatie-Chat/align-app}"
cd "$(dirname "$0")/.."

if [ "${SKIP_TSC:-0}" != "1" ]; then
  echo "== tsc"; npx tsc --noEmit
fi

# next.config.js acceptă doar SHA complet (40 hex) → /api/health afișează commit.short (16 hex)
COMMIT="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
MARK="$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then MARK="${MARK}-dirty"; fi
MARK="${MARK}-$(date +%Y%m%d%H%M)"
echo "$COMMIT" > .deploy-commit
echo "== sincronizare → $HOST:$REMOTE_DIR (build $MARK, commit $COMMIT)"
tar -czf - \
  --exclude=node_modules --exclude=.next --exclude='.env' --exclude='.env.*' \
  --exclude=.vercel --exclude=public/_chatDev --exclude=backup.dump --exclude=tsconfig.tsbuildinfo \
  --exclude=Untitled --exclude=docker-compose.override.yml \
  . | ssh "$HOST" "mkdir -p '$REMOTE_DIR' && tar -C '$REMOTE_DIR' -xzf -"

echo "== deploy pe server"
ssh "$HOST" "BUILD_COMMIT_SHA='$COMMIT' bash '$REMOTE_DIR/deploy/hetzner-deploy.sh'"
echo "== verificare finală"
curl -s -m 15 https://chat.diebel.ro/api/health; echo
