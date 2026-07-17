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
| Queues / cache | Redis |
| Infra | Docker Compose |

## Quick start

### 1. Environment

```bash
cp .env.example .env
```

### 2. Infrastructure

```bash
docker compose up -d
```

Starts PostgreSQL, Redis, and n8n.

### 3. Backend

```bash
cd apps/backend
cp ../../.env .env   # or symlink
npm install
npx prisma migrate dev --name init
npm run start:dev
```

Health: `GET http://localhost:3000/api/health`

Workflow stubs: `POST http://localhost:3000/api/workflows/:name`

### 4. Playwright (smoke)

```bash
cd apps/playwright
npm install
npm run start
```

### 5. n8n

Open http://localhost:5678 — import stubs from `apps/n8n/workflows/`.

## Cursor

Rules: `.cursor/rules/`  
Prompts: `.cursor/prompts/`

## Important

Do **not** implement hh.ru scraping or AI prompts until Phase 0 is approved.
