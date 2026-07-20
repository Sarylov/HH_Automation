# Apply statuses and reason codes

Canonical reference for vacancy apply outcomes in Playwright, backend `Application`, and Ops UI.

## Application.status

| Code | Russian (UI) | Meaning |
|------|----------------|---------|
| `APPLIED` | Отклик отправлен | Apply confirmed (Chat button appeared). May include cover-letter warning in `errorMessage`. |
| `NEEDS_MANUAL` | Нужны ручные действия | Apply could not complete automatically (test, questionnaire, no Chat after 15s). |
| `FAILED` | Ошибка | Technical or unrecoverable failure (LLM, Playwright crash, button not found). |
| `STUB` | Тестовый прогон | `DRY_RUN=true` — letter/analysis generated, no browser submit. |

## Apply success detection (Playwright)

1. Click **Откликнуться**.
2. Submit response popup if visible (resume selection).
3. Wait up to **15 seconds** for **Чат** button (`data-qa="vacancy-response-link-view-topic"` or link/button «Чат»).
4. If Chat appears → apply confirmed.
5. If no Chat → `NEEDS_MANUAL` with specific reason.

**Already applied:** if «Вы откликнулись» or Chat is visible before click → skip (`already_applied`).

## Cover letter via chat

After Chat is confirmed:

1. Click **Чат**.
2. Click **Добавить сопроводительное** (`data-qa="chatik-chat-message-applicant-action"`).
3. Fill `textarea[data-qa="chatik-new-message-text"]`.
4. Send.
5. Success when a new chat message contains the letter text.

## Reason codes

### Success (no warning)

| Code | When |
|------|------|
| `cover_letter_sent_via_chat` | Letter appeared as new chat message |
| `applied_confirmed` | Apply confirmed, no letter step (reserved) |

### Success with warning (`APPLIED` + `errorMessage`)

| Code | Russian (UI) | When |
|------|----------------|------|
| `cover_letter_skipped` | Отклик без письма | No cover letter passed to Playwright |
| `cover_letter_attach_unavailable` | Кнопка «Добавить сопроводительное» недоступна | Chat open but attach action missing |
| `cover_letter_attach_failed` | Письмо не удалось отправить | Send clicked but message not seen in chat |

### Manual (`NEEDS_MANUAL`)

| Code | Russian (UI) | When |
|------|----------------|------|
| `chat_not_available_after_apply` | Нет кнопки «Чат» после отклика | Default when apply not confirmed in 15s |
| `test_required` | Требуется пройти тест | Test step detected in modal |
| `questionnaire_required` | Требуется анкета | Questionnaire detected in modal |

### Skip / failure

| Code | Outcome |
|------|---------|
| `already_applied` | Skip — already responded on hh.ru |
| `apply_button_not_found` | `FAILED` |
| `apply_failed` | `FAILED` — Playwright exception |
| `llm_*` | `FAILED` — letter/analysis generation |

## Ops UI

- Status badge: Russian label from `APPLICATION_STATUS_LABELS`.
- Note column: Russian label from `APPLY_REASON_LABELS` (`apps/web/src/lib/apply-labels.ts`).

See also: [processes.md](./processes.md)
