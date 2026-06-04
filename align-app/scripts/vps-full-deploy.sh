#!/usr/bin/env bash
# Deploy complet pe VPS: git pull, Docker app, nginx, verificări.
set -euo pipefail
REPO=/root/Aplicatie-Chat
APP="$REPO/align-app"

cd "$REPO"
git fetch origin
git reset --hard origin/main

cd "$APP"
export GIT_COMMIT_SHA="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
export BUILD_COMMIT_SHA="$GIT_COMMIT_SHA"

bash scripts/vps-deploy.sh
bash scripts/vps-apply-nginx.sh
bash scripts/vps-post-deploy-check.sh

echo ""
echo "=== verify-stack (local pe server) ==="
node scripts/verify-stack.mjs || true
