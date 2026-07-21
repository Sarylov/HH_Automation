import type { Locator, Page } from 'playwright';

export type VacancyAlreadyAppliedReason =
  | 'already_applied'
  | 'rejected_by_employer';

export type VacancyResponseState = {
  alreadyApplied: boolean;
  reason?: VacancyAlreadyAppliedReason;
};

const RESPONDED_TEXT = /вы\s*откликнулись|отклик\s*отправлен/i;
const REJECTED_TEXT = /вам\s+отказали/i;

export function chatButton(page: Page): Locator {
  return page
    .locator('[data-qa="vacancy-response-link-view-topic"]')
    .or(page.getByRole('link', { name: /^чат$/i }))
    .or(page.getByRole('button', { name: /^чат$/i }));
}

/** First visible locator among all matches (avoids hidden DOM duplicates). */
export async function firstVisible(locator: Locator): Promise<Locator | null> {
  const count = await locator.count();
  for (let i = 0; i < count; i++) {
    const candidate = locator.nth(i);
    if (await candidate.isVisible().catch(() => false)) {
      return candidate;
    }
  }
  return null;
}

export async function isChatVisible(page: Page): Promise<boolean> {
  return (await firstVisible(chatButton(page))) !== null;
}

export async function detectVacancyResponseState(
  page: Page,
): Promise<VacancyResponseState> {
  const rejected = await page
    .getByText(REJECTED_TEXT)
    .first()
    .isVisible()
    .catch(() => false);
  if (rejected) {
    return { alreadyApplied: true, reason: 'rejected_by_employer' };
  }

  const responded = await page
    .getByText(RESPONDED_TEXT)
    .first()
    .isVisible()
    .catch(() => false);
  if (responded) {
    return { alreadyApplied: true, reason: 'already_applied' };
  }

  if (await isChatVisible(page)) {
    return { alreadyApplied: true, reason: 'already_applied' };
  }

  return { alreadyApplied: false };
}
