# HH Automation — Architecture

## Goal

Automate job search and application on hh.ru to maximize interview invitations while keeping realistic user behavior.

## High-level topology

```
n8n (orchestration)
        │
        ▼
Backend API (NestJS — business logic, DB, LLM)
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

## Internal backend layering

```
Controller → UseCase → Repository → PostgreSQL (Prisma)
```

## Business processes

| Process | Schedule / trigger | Owner entrypoint |
|---------|-------------------|------------------|
| Resume Maintainer | Every hour | n8n → `POST /workflows/resume-maintainer` |
| Resume Optimizer | Every 3 days | n8n → `POST /workflows/resume-optimizer` |
| Vacancy Scanner | Every 15–20 min (working hours) | n8n → `POST /workflows/vacancy-scanner` |
| Apply Worker | Queue | n8n/queue → `POST /workflows/apply` |
| Chat Processor | Every few minutes | n8n → `POST /workflows/chat-processor` |
| Follow-up Worker | Once per day | n8n → `POST /workflows/follow-up` |
| Health Check | Every 30 minutes | n8n → `GET /health` (+ deep checks) |

Each process must be **independent**, **restartable**, **idempotent**, and **observable**.

## Data stores

- **PostgreSQL** — source of truth (vacancies, applications, chats, resumes, jobs)
- **Redis** — optional queues / locks for workers

## Observability

- Structured logs (correlation / workflow IDs from n8n)
- Health endpoint(s)
- Screenshots on Playwright failures
- Error workflow in n8n for alerts

## Out of scope (foundation phase)

- Real hh.ru scraping
- AI prompt implementation
- Full business logic of workers
