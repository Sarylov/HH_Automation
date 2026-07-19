# HH Automation — Agent instructions

## Implementation plan (required)

Follow the phased plan in every chat:

1. **Canonical plan:** [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
2. **Progress checkboxes:** [ROADMAP.md](ROADMAP.md)
3. **Architecture:** [ARCHITECTURE.md](ARCHITECTURE.md)

### Rules of engagement

- Do not skip phases (no vacancy scraping before Phase 1 auth/health is done)
- Locked decisions: n8n = orchestration only; NestJS = business logic; Playwright = browser only; apply queue = Postgres `ApplyJob` paced by n8n `apply-next`; auth via Playwright `storageState`; LLM = OpenAI-compatible structured JSON; Ops UI = `apps/web` read-only via Backend API
- After finishing a phase, update checkboxes in `ROADMAP.md`
- Current focus: Phase 0–7 complete (Ops UI + CI/CD); ops model = daily scan + n8n-paced apply (no Redis/BullMQ)
