# HH Automation — Roadmap

Полный поэтапный план (источник истины): **[docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md)**

Архитектура: [ARCHITECTURE.md](./ARCHITECTURE.md)

## Phase 0 — Foundation

- [x] Monorepo layout (`apps/backend`, `apps/playwright`, `apps/n8n`; `apps/web` in Phase 7)
- [x] Cursor rules and prompts
- [x] Docker Compose (PostgreSQL, n8n; Redis removed)
- [x] NestJS + Prisma scaffolding
- [x] Playwright TypeScript scaffolding
- [x] Phased implementation plan saved (`docs/IMPLEMENTATION_PLAN.md` + rule `08-implementation-plan.mdc`)
- [x] Confirm env secrets and local `docker compose up`
- [x] `prisma migrate dev --name init`
- [x] Smoke: health + workflow stubs + Playwright

## Phase 1 — Auth & Health

- [x] Playwright session/login (`storageState`)
- [x] Backend auth status + deep health (api/db/playwright/session)
- [x] n8n Health Check workflow + Error Workflow notify stub
- [x] `AuthSession` model

## Phase 2 — Vacancy pipeline

- [x] Prisma: `Vacancy`, `Application`, `ApplyJob`
- [x] Vacancy Scanner + duplicate upsert
- [x] Apply queue = Postgres `ApplyJob` (BullMQ/Redis removed; n8n `apply-next`)
- [x] Apply Worker skeleton (no LLM yet)
- [x] n8n scanner + apply-next stubs

## Phase 3 — Applications & cover letters

- [x] LLM adapter (structured JSON)
- [x] Vacancy analysis + cover letter use cases
- [x] Human-like delay policy
- [x] Real apply via Playwright + persist result

## Phase 4 — Resume maintenance

- [x] Resume Maintainer (hourly raise)
- [x] Resume Optimizer (every 3 days, two resumes)

## Phase 5 — Messaging

- [x] Chat Processor (templates / AI / rejection / interview notify)
- [x] Follow-up Worker (max 3 reminders)

## Phase 6 — Hardening

- [x] Rate limits / anti-ban pacing / working hours
- [x] Metrics and alerting
- [x] `DRY_RUN` E2E mode
- [x] Production deployment runbook

## Phase 7 — Ops UI (`apps/web`)

- [x] Backend read API: list apply-jobs, list/get applications (+ vacancy join)
- [x] Scaffold `apps/web` (Vite, React, TypeScript, Tailwind)
- [x] Queue page (ApplyJob table + metrics strip)
- [x] Applications page (table: when, vacancy, status; cover letter → modal toggle)
- [x] Dev proxy `/api` → backend; root scripts / optional Compose service
- [x] Docs: `apps/web/README.md`, docker/runbook notes
- [x] Docker `hh-web` + Traefik `WEB_DOMAIN` + CI/CD GHCR deploy

---

**Текущий фокус:** Phase 7 complete — Ops UI live (read-only).
