# Init Feature

You are adding a feature to HH Automation. Follow this sequence:

1. **Clarify** the business process and which service owns it (n8n / backend / playwright / LLM).
2. **Design** the use case API (request/response DTOs) and data model changes if any.
3. **Scaffold** only:
   - Backend: controller + use case + repository interfaces/stubs
   - Playwright: action modules if browser steps are needed
   - n8n: workflow stub (schedule + HTTP call to backend)
4. **Do not** implement scraping, AI prompts, or full business logic unless explicitly requested.
5. Keep modules small; update ARCHITECTURE.md / ROADMAP.md if the process is new.
6. Wait for approval before deep implementation.
