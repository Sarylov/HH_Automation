# HH Automation System

Automated job search and application orchestration for hh.ru.

See [ROADMAP.md](./ROADMAP.md) for phase progress. Current focus: **Phase 0–7 complete** (Ops UI live).

## Architecture

```
Ops UI (apps/web) → Backend (NestJS) ← n8n
                         ↓
                    Playwright → hh.ru
```

Full details: [ARCHITECTURE.md](./ARCHITECTURE.md)

**Implementation plan (follow across chats):** [docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) · progress: [ROADMAP.md](./ROADMAP.md)

## Stack

| Area | Tech |
|------|------|
| Orchestration | n8n |
| Backend | NestJS, TypeScript, Prisma, PostgreSQL |
| Automation | Playwright |
| Ops UI | Vite, React, Tailwind (`apps/web`) |
| Apply queue | Postgres `ApplyJob` + n8n `apply-next` |
| Infra | Docker Compose |

## Monorepo

```
apps/
  backend/     # NestJS API
  playwright/  # browser automation
  n8n/         # workflow stubs
  web/         # Ops UI (Phase 7)
```

## Quick start

### 1. Environment

```bash
cp .env.example .env
```

### 2. Local dev (host apps + Postgres in Docker)

```bash
npm install
npm run start:infra   # Postgres only
npm start             # backend + playwright + web (hot reload)
```

| Service | URL |
|---------|-----|
| Backend | http://localhost:3000 |
| Playwright | http://localhost:3100 |
| Ops UI | http://localhost:5173 |

Install app dependencies once per package if needed: `npm install --prefix apps/backend`, same for `apps/playwright` and `apps/web`.

### 3. Infrastructure + apps (Docker)

```bash
# Local: build images and start all services
export GHCR_OWNER=local
docker compose build backend playwright
docker compose up -d
```

Starts PostgreSQL, Playwright, Backend, and n8n.

Server + Traefik: see [docs/runbook-deploy.md](./docs/runbook-deploy.md) and [docker/README.md](./docker/README.md).

CI/CD (push to `main` → GHCR → SSH deploy): [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml).

### 4. Verify

- Backend health: `GET http://localhost:3000/api/health`
- Playwright: `GET http://localhost:3100/health`
- n8n: http://localhost:5678 — import stubs from `apps/n8n/workflows/`.
- Ops UI (after Phase 7 scaffold): http://localhost:5173 — see [apps/web/README.md](./apps/web/README.md)
- Ops UI (Docker): http://127.0.0.1:8080

### 5. Manual HH login (once)

```bash
cd apps/playwright
npm install
npm run auth:manual
```

Copy `apps/playwright/.auth/storage-state.json` onto the server (same path) if you logged in locally.

## Cursor

Rules: `.cursor/rules/`  
Prompts: `.cursor/prompts/`

## Important

Follow the current phase in [docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md). Do not skip phases or mix layer boundaries (n8n / backend / playwright / LLM / web).
