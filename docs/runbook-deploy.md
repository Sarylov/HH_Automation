# Deploy runbook (Compose / GHCR / Traefik)

## Prerequisites

- Docker + Compose on the VPS
- Existing Traefik (shared Docker network)
- Filled `.env` on the server (see `.env.example`)
- Valid Playwright `storageState` at `apps/playwright/.auth/storage-state.json`
- GitHub Actions secrets/variables (see below)

## Containers

| Name | Role |
|------|------|
| `hh-postgres` | Database |
| `hh-playwright` | Browser service (`:3100`) |
| `hh-backend` | API (`:3000`), migrates DB on start |
| `hh-n8n` | Orchestration UI (via Traefik) |

Traefik stays outside this compose.

## GitHub Actions (push to `main`)

Workflow: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)

Flow: build `hh-backend` + `hh-playwright` → push GHCR → SSH → `git pull` + `compose pull/up`.

### Secrets (Settings → Secrets and variables → Actions)

| Secret | Purpose |
|--------|---------|
| `DEPLOY_HOST` | VPS IP or hostname |
| `DEPLOY_USER` | SSH user |
| `DEPLOY_SSH_KEY` | Private key (public key in `~/.ssh/authorized_keys` on VPS) |
| `DEPLOY_PATH` | Absolute path to repo clone, e.g. `/opt/hh-automation` |
| `GHCR_READ_TOKEN` | Optional. PAT with `read:packages` if GHCR images are private |

### Variables

| Variable | Purpose |
|----------|---------|
| `GHCR_OWNER` | Optional. Defaults to `github.repository_owner` (lowercased in workflow) |

Also set `GHCR_OWNER` in the **server** `.env` so compose resolves the same image names.

### One-time VPS setup

1. Clone repo to `DEPLOY_PATH`, create `.env` from `.env.example` (prod values).
2. `mkdir -p apps/playwright/.auth apps/playwright/artifacts` and copy `storage-state.json`.
3. Ensure Traefik network exists; set `N8N_DOMAIN` / `TRAEFIK_*`.
4. If packages are private: `docker login ghcr.io` once (or rely on `GHCR_READ_TOKEN` in Actions).
5. SSH: install the deploy public key for `DEPLOY_USER`.
6. First start:
   ```bash
   cd "$DEPLOY_PATH"
   docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d
   ```
7. Confirm git remote can `git pull origin main` as `DEPLOY_USER`.

## Start order

### Server (recommended)

```bash
docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d
```

Or push to `main` and let Actions deploy.

### Local (optional build)

```bash
export GHCR_OWNER=local
docker compose build backend playwright
docker compose up -d
```

## Verify

1. `curl -s http://127.0.0.1:3000/api/health` → `status: ok` (or intentional `degraded`)
2. `curl -s http://127.0.0.1:3100/health` → playwright up
3. `curl -s http://127.0.0.1:3000/api/metrics` → no unexpected `alerts`
4. n8n UI: `https://$N8N_DOMAIN`

## Env checklist (prod)

| Variable | Notes |
|----------|--------|
| `GHCR_OWNER` / `IMAGE_TAG` | Match GHCR images |
| `DATABASE_URL` | Overridden inside compose to `@postgres` for backend |
| `PLAYWRIGHT_BASE_URL` | Overridden to `http://playwright:3100` for backend |
| `BACKEND_API_URL` | `http://backend:3000/api` for n8n |
| `LLM_*` | Required for apply / chat / resume optimize |
| `DRY_RUN` | `true` for first smoke; `false` for live |
| `WORKING_HOURS_*` | Gate scanner/apply |
| `APPLY_MAX_PER_HOUR` / `APPLY_MAX_PER_DAY` | Anti-ban caps (in-memory per process) |
| `APPLY_JOB_STUCK_MINUTES` | Reclaim stuck RUNNING in apply-next (default 30) |
| `HH_RESUME_IDS` | Two resumes for optimizer |
| `N8N_DOMAIN` / `TRAEFIK_*` | Public n8n via Traefik |

## Database backups

```bash
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  > "backups/hh_$(date +%Y%m%d).sql"
```

Keep at least 7 daily dumps. Test restore on a throwaway DB before relying on it.

## Session rotation

1. Pause apply/chat workers or set `DRY_RUN=true`
2. Re-login via Playwright manual flow / regenerate `apps/playwright/.auth/storage-state.json`
3. `POST /api/auth/refresh` until session is up
4. Confirm `GET /api/metrics` → `session.stale: false`
5. Re-enable live mode

Session max age: `SESSION_MAX_AGE_HOURS` (default 72).

## n8n

Behind Traefik: open `https://$N8N_DOMAIN`.

Import/create workflows from `apps/n8n/workflows/*.stub.json` hints:

- Health Check → `GET /api/health` (+ optional `GET /api/metrics`)
- Vacancy Scanner / Apply / Resume / Chat / Follow-up as documented
- Error Workflow → notify on HTTP failure or `status: degraded` / non-empty `alerts`

## Smoke (DRY_RUN E2E)

1. `DRY_RUN=true`
2. `POST /api/workflows/vacancy-scanner` with `enqueue: true`
3. `POST /api/workflows/apply-next` (or `apply` + `vacancyId` for a single smoke)
4. Confirm Application has letter/analysis, status `STUB`, no real “Откликнуться” click
5. Optional: `resume-maintainer`, `chat-processor` with dry-run

See also: [incident-checklist.md](./incident-checklist.md)
