# Docker notes

Root `docker-compose.yml` runs:

- **postgres** — primary database (app schema `public`, n8n schema `n8n`)
- **redis** — queues / locks (Phase 2+)
- **n8n** — orchestration UI on port 5678

Backend and Playwright run on the host during development (or add services later).

Optional future images can live under this folder (`Dockerfile.backend`, etc.).
