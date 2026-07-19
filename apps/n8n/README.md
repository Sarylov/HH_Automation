# n8n orchestration

Workflows here are **stubs** (JSON hints), not full n8n exports.

Rules:

- One workflow = one responsibility
- Call Backend API only — no business logic in n8n
- Enable retries + Error Workflow
- Pass `correlationId` when available

See `docs/processes.md` for the process catalog.

Apply pacing: n8n cron → `POST /workflows/apply-next` (claims oldest Postgres `ApplyJob`).
Scanner: typically once per day with `enqueue: true`.

## Traefik (server)

```bash
docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d
```

Set `N8N_DOMAIN` and HTTPS URL vars in `.env` — details in `docker/README.md` and `docs/runbook-deploy.md`.
