# Deploy runbook (Compose / local-prod)

## Prerequisites

- Docker + Compose
- Filled `.env` (see `.env.example`)
- Valid Playwright `storageState` (session) for hh.ru

## Start order

1. `docker compose up -d` — Postgres, Redis, n8n
2. Backend: `cd apps/backend && npx prisma migrate deploy && npm run start:prod` (or `start:dev`)
3. Playwright: `cd apps/playwright && npm run start` (service on `PLAYWRIGHT_PORT`)
4. Verify: `GET /api/health` → `status: ok` (or `degraded` only if intentional)
5. Verify: `GET /api/metrics` → no unexpected `alerts`

## Env checklist (prod)

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Postgres from Compose |
| `REDIS_URL` | Redis from Compose |
| `PLAYWRIGHT_BASE_URL` | Reachable from backend |
| `LLM_*` | Required for apply / chat / resume optimize |
| `DRY_RUN` | `true` for first smoke; `false` for live |
| `WORKING_HOURS_*` | Gate scanner/apply |
| `APPLY_MAX_PER_HOUR` / `APPLY_MAX_PER_DAY` | Anti-ban caps |
| `HH_RESUME_IDS` | Two resumes for optimizer |

## Database backups

```bash
# Example daily dump (host with docker)
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  > "backups/hh_$(date +%Y%m%d).sql"
```

Keep at least 7 daily dumps. Test restore on a throwaway DB before relying on it.

## Session rotation

1. Pause apply/chat workers or set `DRY_RUN=true`
2. Re-login via Playwright manual flow / `POST /auth/login` (or regenerate `storage-state.json`)
3. `POST /api/auth/refresh` (or wait for health check) until `session: up`
4. Confirm `GET /api/metrics` → `session.stale: false`
5. Re-enable live mode

Session max age: `SESSION_MAX_AGE_HOURS` (default 72). Health/metrics mark stale sessions.

## n8n

Import/create workflows from `apps/n8n/workflows/*.stub.json` hints:

- Health Check → `GET /api/health` (+ optional `GET /api/metrics`)
- Vacancy Scanner / Apply / Resume / Chat / Follow-up as documented
- Error Workflow → notify on HTTP failure or `status: degraded` / non-empty `alerts`

## Smoke (DRY_RUN E2E)

1. `DRY_RUN=true`
2. `POST /api/workflows/vacancy-scanner`
3. Wait for apply jobs or `POST /api/workflows/apply` with a `vacancyId`
4. Confirm Application has letter/analysis, status `STUB`, no real “Откликнуться” click
5. Optional: `resume-maintainer`, `chat-processor` with dry-run

See also: [incident-checklist.md](./incident-checklist.md)
