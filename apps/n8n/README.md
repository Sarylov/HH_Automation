# n8n orchestration

Workflows here are **stubs** (JSON hints), not full n8n exports.

Rules:

- One workflow = one responsibility
- Call Backend API only — no business logic in n8n
- Enable retries + Error Workflow
- Pass `correlationId` when available

See `docs/processes.md` for the process catalog.
