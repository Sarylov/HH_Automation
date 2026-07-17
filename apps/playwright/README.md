# Playwright service

Browser automation HTTP service (no business logic).

```bash
npm install
npm run start   # http://127.0.0.1:3100
```

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Service up |
| GET | `/auth/status` | Probe HH session via `storageState` |
| POST | `/auth/login` | Login skeleton (optional credentials) |
| POST | `/vacancies/search` | Search SERP (`{ text, area?, pages? }`) |
| GET | `/vacancies/:id` | Open vacancy card |
| POST | `/vacancies/:id/apply-stub` | Open vacancy, detect apply button (no click) |

Session file: `PLAYWRIGHT_STORAGE_STATE_PATH` (default `./.auth/storage-state.json`).
Artifacts on failure: `PLAYWRIGHT_ARTIFACTS_DIR`.

## Manual login (recommended)

```bash
cd apps/playwright
npm run auth:manual
```

Opens a visible browser → you log in on hh.ru → press Enter in the terminal → session is saved.

## Headed debug (see browser during search)

Root `.env` is loaded automatically. Set:

```env
PLAYWRIGHT_HEADLESS=false
PLAYWRIGHT_DEBUG_PAUSE_MS=15000
```

Restart Playwright (`npm run start`). On search, the browser stays open for 15s before closing so you can verify the SERP.

Check startup log: `headless: false`.
