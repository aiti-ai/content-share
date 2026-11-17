#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run typecheck
npm test
npm run build
npm run build:catalog
echo "verify: OK"
