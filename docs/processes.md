# Process catalog

| Workflow | Schedule | Backend endpoint |
|----------|----------|------------------|
| Resume Maintainer | Every hour | `POST /api/workflows/resume-maintainer` |
| Resume Optimizer | Every 3 days | `POST /api/workflows/resume-optimizer` |
| Vacancy Scanner | Every 15–20 min (working hours) | `POST /api/workflows/vacancy-scanner` |
| Apply Worker | Queue | `POST /api/workflows/apply` |
| Chat Processor | Every few minutes | `POST /api/workflows/chat-processor` |
| Follow-up Worker | Daily | `POST /api/workflows/follow-up` |
| Health Check | Every 30 min | `GET /api/health` |

n8n owns scheduling only. Backend owns business logic.

## Ops docs

- Deploy / backups / session rotation: [runbook-deploy.md](./runbook-deploy.md)
- Incidents (session, captcha, queue): [incident-checklist.md](./incident-checklist.md)
- Metrics: `GET /api/metrics`
- Health: `GET /api/health` (includes queue + workingHours + sessionAgeHours)
