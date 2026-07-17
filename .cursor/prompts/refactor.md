# Refactor

When refactoring HH Automation code:

1. Preserve public API contracts unless migration is planned.
2. Move logic only toward correct layers (Controller → UseCase → Repository).
3. Extract duplication; do not invent new abstractions without need (KISS).
4. Keep Playwright free of business rules.
5. Prefer small PRs; one concern per change.
6. Update tests/stubs and docs if behavior or structure changes.
7. Do not mix feature work into a refactor PR.
