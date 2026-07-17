#!/bin/sh
set -eu

echo "[backend] prisma migrate deploy"
npx prisma migrate deploy

echo "[backend] starting API"
exec node dist/main.js
