#!/usr/bin/env bash
# Sincronizează fișiere locale pe VPS și rebuild app (fără git pull).
set -euo pipefail
REPO=/root/Aplicatie-Chat
APP="$REPO/align-app"
cd "$APP"
export GIT_COMMIT_SHA="$(git rev-parse HEAD 2>/dev/null || echo local-sync)"
export BUILD_COMMIT_SHA="$GIT_COMMIT_SHA"
bash scripts/vps-deploy.sh
bash scripts/vps-post-deploy-check.sh
