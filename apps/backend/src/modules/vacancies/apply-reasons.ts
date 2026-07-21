/** Apply reason codes returned by Playwright apply action. */

export const APPLY_WARNING_REASONS = new Set([
  'cover_letter_skipped',
  'cover_letter_attach_unavailable',
  'cover_letter_attach_failed',
]);

export const APPLY_SUCCESS_REASONS = new Set([
  'cover_letter_sent_via_chat',
  'cover_letter_sent_via_modal',
  'cover_letter_sent_in_apply_modal',
  'applied_confirmed',
]);

export function isApplyWarningReason(reason: string | undefined): boolean {
  return reason != null && APPLY_WARNING_REASONS.has(reason);
}

export function applyErrorMessage(
  reason: string | undefined,
): string | null {
  if (!reason) return null;
  if (APPLY_SUCCESS_REASONS.has(reason)) return null;
  if (APPLY_WARNING_REASONS.has(reason)) return reason;
  return null;
}
