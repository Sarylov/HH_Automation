# Ops UI (`apps/web`)

Read-only dashboard for HH Automation: apply queue and applications.

Phase: **7** — see [docs/IMPLEMENTATION_PLAN.md](../../docs/IMPLEMENTATION_PLAN.md) and [ROADMAP.md](../../ROADMAP.md).

## Stack

- Vite
- React + TypeScript (strict)
- Tailwind CSS
- React Router
- TanStack Query (lists + polling)

## Pages

| Route | Data | UI |
|-------|------|-----|
| `/queue` | `ApplyJob` + vacancy | Table (status, title, company, queuedAt, attempts, error) |
| `/applications` | `Application` + vacancy | Table (appliedAt, status, title, company); cover letter → modal |

Layout: metrics strip from `GET /api/metrics` (queue counts, applies today, session, rate limit).

### Cover letter modal

- Click letter preview → open modal with full text
- Second click on the same control, Esc, or backdrop → close

## Backend API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/metrics` | Header metrics |
| `GET` | `/api/apply-jobs` | Queue list (`status`, `limit`, `cursor`) |
| `GET` | `/api/applications` | Applications list |
| `GET` | `/api/applications/:id` | Detail including `coverLetter` |

## Local development

```bash
# Terminal 1 — backend (and infra)
docker compose up -d
npm run backend:dev

# Terminal 2 — UI
npm run web:dev
```

Vite proxies `/api` → `http://127.0.0.1:3001` (local backend `PORT` in `apps/backend/.env`). UI: http://localhost:5173

If `/api/*` returns 404 while Nest logs show routes mapped, another process may own `127.0.0.1:3000` (e.g. Cursor Port Forward). Use `PORT=3001` locally or free that port.

Docker (nginx + `/api` proxy to backend): http://127.0.0.1:8080 (`WEB_PORT`).

## Production

- Image: `ghcr.io/$GHCR_OWNER/hh-web` via [`docker/Dockerfile.web`](../../docker/Dockerfile.web)
- Compose service `web`; Traefik host: `WEB_DOMAIN` (see `docker-compose.traefik.yml`)

## Boundaries

```
Browser → Backend API → Postgres
       ↘ must NOT call Playwright or n8n
```

Rules: [`.cursor/rules/09-web.mdc`](../../.cursor/rules/09-web.mdc)
