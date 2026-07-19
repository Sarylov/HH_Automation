# Docker notes

Root `docker-compose.yml` runs:

| Service | Image | Notes |
|---------|--------|--------|
| **postgres** | `postgres:16-alpine` | app schema `public`, n8n schema `n8n` |
| **playwright** | `ghcr.io/$GHCR_OWNER/hh-playwright` | Chromium automation; `shm_size=1gb` |
| **backend** | `ghcr.io/$GHCR_OWNER/hh-backend` | Nest API; runs `prisma migrate deploy` on start |
| **n8n** | `n8nio/n8n` | orchestration UI (`127.0.0.1:5678` locally) |

Dockerfiles: [Dockerfile.backend](./Dockerfile.backend), [Dockerfile.playwright](./Dockerfile.playwright).

Local build (no GHCR):

```bash
export GHCR_OWNER=local
docker compose build backend playwright
docker compose up -d
```

## Traefik (existing proxy on the server)

Do **not** add Traefik to this compose — attach n8n to your already-running Traefik network.

```bash
docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d
```

| Variable | Example | Must match |
|----------|---------|------------|
| `N8N_DOMAIN` | `n8n.example.com` | DNS → server |
| `N8N_HOST` | same as domain | n8n public host |
| `N8N_PROTOCOL` | `https` | |
| `N8N_EDITOR_BASE_URL` | `https://n8n.example.com/` | |
| `N8N_WEBHOOK_URL` | `https://n8n.example.com/` | |
| `TRAEFIK_NETWORK` | `proxy` | Traefik container network |
| `TRAEFIK_ENTRYPOINT` | `websecure` | Traefik entryPoint name |
| `TRAEFIK_CERT_RESOLVER` | `letsencrypt` | Traefik certificateResolver name |
| `GHCR_OWNER` | github user/org (lowercase) | image namespace |
| `IMAGE_TAG` | `latest` | usually `latest` from CI |

## Session file

Place HH `storage-state.json` at:

`apps/playwright/.auth/storage-state.json`

Compose mounts that dir into playwright (rw) and backend (ro).
