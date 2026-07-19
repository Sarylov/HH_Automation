# HH Automation — Architecture

## Goal

Automate job search and application on hh.ru to maximize interview invitations while keeping realistic user behavior.

## High-level topology

```
Ops UI (apps/web) ──GET──► Backend API
n8n (orchestration) ──POST──► Backend API (NestJS — business logic, DB, LLM)
                                    │
                                    ▼
                          Playwright Automation (browser only)
                                    │
                                    ▼
                                  hh.ru
```

| Service | Owns | Does not own |
|---------|------|--------------|
| **n8n** | Cron, retries, workflow coordination, queues triggers | Business rules, scraping, AI prompts |
| **Backend** | Use cases, Prisma/PostgreSQL, LLM calls, decisions | Browser DOM, cron scheduling |
| **Playwright** | Login, clicks, read/send messages, raise resume | Filtering, AI, scheduling |
| **LLM** | Structured text generation | Side effects |
| **Web** | Read-only ops UI (queue, applications, metrics) | Business logic, DB, Playwright, mutations |

## Internal backend layering

```
Controller → UseCase → Repository → PostgreSQL (Prisma)
```

## Business processes

| Process | Schedule / trigger | Owner entrypoint |
|---------|-------------------|------------------|
| Resume Maintainer | Every hour | n8n → `POST /workflows/resume-maintainer` |
| Resume Optimizer | Every 3 days | n8n → `POST /workflows/resume-optimizer` |
| Vacancy Scanner | Once per day (working hours) | n8n → `POST /workflows/vacancy-scanner` |
| Apply Worker | n8n cron pace | n8n → `POST /workflows/apply-next` (or `apply` + vacancyId for smoke) |
| Chat Processor | Every few minutes | n8n → `POST /workflows/chat-processor` |
| Follow-up Worker | Once per day | n8n → `POST /workflows/follow-up` |
| Health Check | Every 30 minutes | n8n → `GET /health` (+ deep checks) |

Each process must be **independent**, **restartable**, **idempotent**, and **observable**.

## Ops UI (Phase 7)

- App: `apps/web` — Vite + React + Tailwind
- Data: Backend read API only (`/api/apply-jobs`, `/api/applications`, `/api/metrics`)
- Pages: Queue (`ApplyJob` table), Applications (`Application` + vacancy table)
- Cover letter: modal on click; second click / Esc / backdrop closes
- No mutations from UI in Phase 7 (no skip / retry / trigger workflows)

## Data stores

- **PostgreSQL** — source of truth (vacancies, applications, apply jobs, chats, resumes, workflow runs)

## Observability

- Structured logs (correlation / workflow IDs from n8n)
- Health endpoint(s)
- Screenshots on Playwright failures
- Error workflow in n8n for alerts
- Ops UI for queue and application inspection
