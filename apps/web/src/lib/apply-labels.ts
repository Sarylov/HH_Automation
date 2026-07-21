/** Application.status → Russian label for Ops UI. */
export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  APPLIED: 'Отклик отправлен',
  FAILED: 'Ошибка',
  NEEDS_MANUAL: 'Нужны ручные действия',
  STUB: 'Тестовый прогон',
};

/** Playwright/backend apply reason codes → Russian label. */
export const APPLY_REASON_LABELS: Record<string, string> = {
  applied_confirmed: 'Отклик подтверждён',
  cover_letter_sent_via_chat: 'Письмо отправлено в чат',
  cover_letter_sent_via_modal: 'Письмо отправлено через модалку',
  cover_letter_sent_in_apply_modal: 'Письмо отправлено в модалке отклика',
  cover_letter_required_in_apply_modal: 'Требуется письмо в модалке отклика',
  cover_letter_skipped: 'Отклик без письма (письмо не передано)',
  cover_letter_attach_unavailable: 'Отклик есть, кнопка «Добавить сопроводительное» недоступна',
  cover_letter_attach_failed: 'Отклик есть, письмо не удалось отправить',
  chat_not_available_after_apply: 'После отклика не появилась кнопка «Чат»',
  test_required: 'Требуется пройти тест',
  questionnaire_required: 'Требуется заполнить анкету',
  apply_button_not_found: 'Кнопка «Откликнуться» не найдена',
  apply_not_confirmed: 'Отклик не подтверждён',
  apply_failed: 'Ошибка отклика',
  already_applied: 'Уже откликались ранее',
  rejected_by_employer: 'Вам отказали (отклик был ранее)',
  already_processed: 'Уже обработано',
  open_failed: 'Не удалось открыть вакансию',
  dry_run: 'Тестовый прогон',
  llm_not_configured: 'LLM не настроен',
  llm_cover_letter_failed: 'Ошибка генерации письма',
  llm_analysis_failed: 'Ошибка анализа вакансии',
  manual_steps_required: 'Нужны ручные действия',
};

export function formatApplicationStatus(status: string): string {
  return APPLICATION_STATUS_LABELS[status] ?? status;
}

export function formatApplyReason(reason: string | null | undefined): string {
  if (!reason) return '—';
  return APPLY_REASON_LABELS[reason] ?? reason;
}

/** Reasons that mean apply succeeded but cover letter had a warning. */
export const APPLY_WARNING_REASONS = new Set([
  'cover_letter_skipped',
  'cover_letter_attach_unavailable',
  'cover_letter_attach_failed',
]);

export function isApplyWarningReason(reason: string | null | undefined): boolean {
  return reason != null && APPLY_WARNING_REASONS.has(reason);
}
