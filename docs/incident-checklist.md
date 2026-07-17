# Incident checklist

## Session expired

**Signals:** `GET /api/health` → `session: down`; metrics `alerts` contains `session_down` / `session_stale`.

1. Confirm Playwright service is up (`playwright: up`)
2. Open hh.ru manually or run login → refresh `storage-state.json`
3. `POST /api/auth/refresh` (or next health tick)
4. Re-check health until `session: up`
5. Resume workers; prefer short `DRY_RUN` smoke first

## Captcha / anti-bot

**Signals:** Playwright apply/chat/raise fails with unexpected UI; screenshots in `PLAYWRIGHT_ARTIFACTS_DIR`.

1. Set `DRY_RUN=true` or stop n8n cron / drain apply queue
2. Solve captcha / login manually in a headed browser with the same profile if needed
3. Save new `storageState`
4. Verify `/applicant/resumes` via auth status
5. Re-enable with lower rate limits (`APPLY_MAX_PER_HOUR`, `HH_ACTION_MIN_INTERVAL_MS`)

## Queue stuck

**Signals:** metrics `queue_stuck_running` / `queue_backlog`; many `ApplyJob` `RUNNING`/`PENDING`.

1. `GET /api/metrics` — note `queue.pending`, `queue.running`
2. Inspect backend logs for `ApplyProcessor` / Playwright timeouts
3. For jobs `RUNNING` > 30 min: mark `FAILED` in DB (or restart backend after confirming no live browser)
4. Check Redis connectivity (`REDIS_URL`)
5. Re-enqueue carefully or re-run scanner with `enqueue: true`
6. If rate-limited (`apply_hour_limit` / `apply_day_limit`): wait for window reset or raise limits consciously

## Apply failures spike

**Signals:** `apply_failures_spike` in metrics; many `Application` `FAILED` today.

1. Sample recent `errorMessage` / workflow metadata
2. Typical causes: LLM not configured, schema mismatch, apply button missing, session
3. Fix root cause; keep `DRY_RUN=true` until a single live apply succeeds

## Interview / manual chat

**Signals:** Chat thread `NEEDS_MANUAL`, `notifyReason: interview_invite` in logs.

1. Do **not** auto-reply
2. Handle in hh.ru UI
3. Mark thread processed manually if needed after human response
