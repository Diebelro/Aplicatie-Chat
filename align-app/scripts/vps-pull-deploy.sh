#!/usr/bin/env bash
# Alias scurt — preferă vps-full-deploy.sh pentru nginx + checks.
set -euo pipefail
cd "$(dirname "$0")/.."
exec bash scripts/vps-full-deploy.sh
