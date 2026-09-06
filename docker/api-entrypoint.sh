#!/bin/sh
set -eu

cd /app

echo "[api] applying Prisma migrations"
cd /app/packages/db
pnpm exec prisma migrate deploy
cd /app

echo "[api] starting Express"
exec pnpm --filter @mazare3/api exec tsx src/index.ts
