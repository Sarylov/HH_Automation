# Process catalog

| Workflow | Schedule | Backend endpoint |
|----------|----------|------------------|
| Resume Maintainer | Every hour | `POST /api/workflows/resume-maintainer` |
| Resume Optimizer | Every 3 days | `POST /api/workflows/resume-optimizer` |
| Vacancy Scanner | Once per day (working hours) | `POST /api/workflows/vacancy-scanner` |
| Apply next | Every few minutes (working hours) | `POST /api/workflows/apply-next` |
| Apply (manual) | On demand | `POST /api/workflows/apply` + `vacancyId` |
| Chat Processor | Every few minutes | `POST /api/workflows/chat-processor` |
| Follow-up Worker | Daily | `POST /api/workflows/follow-up` |
| Health Check | Every 30 min | `GET /api/health` |

n8n owns scheduling only. Backend owns business logic.

Scanner with `enqueue: true` creates Postgres `ApplyJob` rows (`PENDING`).  
`apply-next` claims the oldest pending job and runs one apply. Empty queue returns `{ status: "EMPTY" }`.

## Ops UI (read-only)

App: [`apps/web`](../apps/web/README.md) → Backend API only. Does not call Playwright or n8n.

| View | API |
|------|-----|
| Metrics strip | `GET /api/metrics` |
| Queue | `GET /api/apply-jobs?status=&limit=&cursor=` |
| Applications | `GET /api/applications?status=&limit=&cursor=` |
| Application detail / cover letter | `GET /api/applications/:id` (or fields from list); UI modal |

UX: table pages; cover letter opens in a modal (toggle close via second click / Esc / backdrop). No mutations from UI in Phase 7.

## Ops docs

- Deploy / backups / session rotation: [runbook-deploy.md](./runbook-deploy.md)
- Incidents (session, captcha, queue): [incident-checklist.md](./incident-checklist.md)
- Metrics: `GET /api/metrics`
- Health: `GET /api/health` (includes queue + workingHours + sessionAgeHours)
