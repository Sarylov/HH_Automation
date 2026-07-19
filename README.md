# HH Automation System

Automated job search and application orchestration for hh.ru.

> Foundation only — no scraping, AI prompts, or business logic yet. See [ROADMAP.md](./ROADMAP.md).

## Architecture

```
n8n → Backend (NestJS) → Playwright → hh.ru
```

Full details: [ARCHITECTURE.md](./ARCHITECTURE.md)

**Implementation plan (follow across chats):** [docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) · progress: [ROADMAP.md](./ROADMAP.md)

## Stack

| Area | Tech |
|------|------|
| Orchestration | n8n |
| Backend | NestJS, TypeScript, Prisma, PostgreSQL |
| Automation | Playwright |
| Apply queue | Postgres `ApplyJob` + n8n `apply-next` |
| Infra | Docker Compose |

## Quick start

### 1. Environment

```bash
cp .env.example .env
```

### 2. Infrastructure + apps (Docker)

```bash
# Local: build images and start all services
export GHCR_OWNER=local
docker compose build backend playwright
docker compose up -d
```

Starts PostgreSQL, Playwright, Backend, and n8n.

Server + Traefik: see [docs/runbook-deploy.md](./docs/runbook-deploy.md) and [docker/README.md](./docker/README.md).

CI/CD (push to `main` → GHCR → SSH deploy): [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml).

### 3. Verify

- Backend health: `GET http://localhost:3000/api/health`
- Playwright: `GET http://localhost:3100/health`
- n8n: http://localhost:5678 — import stubs from `apps/n8n/workflows/`.

### 4. Manual HH login (once)

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

Do **not** implement hh.ru scraping or AI prompts until Phase 0 is approved.
