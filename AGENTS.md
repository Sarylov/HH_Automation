# HH Automation — Agent instructions

## Implementation plan (required)

Follow the phased plan in every chat:

1. **Canonical plan:** [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
2. **Progress checkboxes:** [ROADMAP.md](ROADMAP.md)
3. **Architecture:** [ARCHITECTURE.md](ARCHITECTURE.md)

### Rules of engagement

- Do not skip phases (no vacancy scraping before Phase 1 auth/health is done)
- Locked decisions: n8n = orchestration only; NestJS = business logic; Playwright = browser only; BullMQ + Redis for apply queue; auth via Playwright `storageState`; LLM = OpenAI-compatible structured JSON
- After finishing a phase, update checkboxes in `ROADMAP.md`
- Current focus: Phase 0–6 complete (hardening done)
