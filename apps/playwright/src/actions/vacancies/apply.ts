import type { PlaywrightConfig } from '../../config.js';
import { withPage } from '../../browser/context.js';
import { createLogger } from '../../logger.js';
import { humanDelay } from '../../utils/human-delay.js';
import { captureFailureArtifacts } from '../../utils/screenshot.js';
import { openVacancy } from './open.js';

const logger = createLogger('vacancies.apply');

export type ApplyVacancyInput = {
  coverLetter?: string;
  dryRun?: boolean;
};

export type ApplyVacancyResult = {
  ok: boolean;
  externalId: string;
  url: string;
  applied?: boolean;
  needsManual?: boolean;
  dryRun?: boolean;
  alreadyApplied?: boolean;
  reason?: string;
  screenshotPath?: string;
};

const APPLY_BUTTON = /откликнуться|отклик/i;
const ALREADY_APPLIED = /вы откликнулись|отклик отправлен/i;

async function fillCoverLetterIfPresent(
  page: import('playwright').Page,
  coverLetter: string,
): Promise<boolean> {
  const textarea = page
    .locator(
      'textarea[data-qa="vacancy-response-popup-form-letter-input"], textarea[name="letter"], textarea',
    )
    .first();

  const visible = await textarea.isVisible().catch(() => false);
  if (!visible) return false;

  await textarea.fill(coverLetter);
  return true;
}

async function submitResponsePopup(
  page: import('playwright').Page,
): Promise<void> {
  const submit = page.getByRole('button', {
    name: /отправить|откликнуться/i,
  });
  await submit.first().click();
}

export async function applyToVacancy(
  config: PlaywrightConfig,
  externalId: string,
  input: ApplyVacancyInput = {},
): Promise<ApplyVacancyResult> {
  const opened = await openVacancy(config, externalId);
  if (!opened.ok) {
    return {
      ok: false,
      externalId,
      url: opened.url,
      reason: opened.reason ?? 'open_failed',
      screenshotPath: opened.screenshotPath,
    };
  }

  try {
    return await withPage(config, async (page) => {
      await page.goto(opened.url, { waitUntil: 'domcontentloaded' });

      const alreadyAppliedLocator = page.getByText(ALREADY_APPLIED).first();
      const alreadyApplied = await alreadyAppliedLocator
        .isVisible()
        .catch(() => false);
      if (alreadyApplied) {
        return {
          ok: true,
          externalId,
          url: opened.url,
          applied: true,
          alreadyApplied: true,
          reason: 'already_applied',
        };
      }

      const applyButton = page.getByRole('button', { name: APPLY_BUTTON }).first();
      const applyVisible = await applyButton.isVisible().catch(() => false);
      if (!applyVisible) {
        const needsManual = await page
          .getByText(/тест|анкет|вопрос/i)
          .first()
          .isVisible()
          .catch(() => false);

        return {
          ok: false,
          externalId,
          url: opened.url,
          needsManual,
          reason: needsManual ? 'manual_steps_required' : 'apply_button_not_found',
        };
      }

      if (input.dryRun) {
        logger.info('Apply dry-run — no click', { externalId });
        return {
          ok: true,
          externalId,
          url: opened.url,
          applied: false,
          dryRun: true,
          reason: 'dry_run',
        };
      }

      await humanDelay(400, 1_200);
      await applyButton.click();

      const popup = page.locator(
        '[data-qa="vacancy-response-popup"], [data-qa="vacancy-response-popup-form"]',
      );
      await popup
        .first()
        .waitFor({ state: 'visible', timeout: 8_000 })
        .catch(() => undefined);

      if (input.coverLetter?.trim()) {
        await fillCoverLetterIfPresent(page, input.coverLetter.trim());
        await humanDelay(300, 900);
      }

      const popupVisible = await popup
        .first()
        .isVisible()
        .catch(() => false);
      if (popupVisible) {
        await submitResponsePopup(page);
      }

      await page
        .getByText(ALREADY_APPLIED)
        .first()
        .waitFor({ state: 'visible', timeout: 15_000 })
        .catch(() => undefined);

      const applied = await page
        .getByText(ALREADY_APPLIED)
        .first()
        .isVisible()
        .catch(() => false);

      if (!applied) {
        const needsManual = await page
          .getByText(/тест|анкет|вопрос|пройдите/i)
          .first()
          .isVisible()
          .catch(() => false);

        return {
          ok: false,
          externalId,
          url: opened.url,
          needsManual,
          reason: needsManual ? 'manual_steps_required' : 'apply_not_confirmed',
        };
      }

      logger.info('Vacancy applied', { externalId });
      return {
        ok: true,
        externalId,
        url: opened.url,
        applied: true,
      };
    });
  } catch (error) {
    logger.error('Apply failed', { externalId, error });
    const shot = await withPage(config, async (page) => {
      await page.goto(opened.url, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
      return captureFailureArtifacts(page, config.artifactsDir, 'apply');
    }).catch(() => ({ screenshotPath: undefined }));

    return {
      ok: false,
      externalId,
      url: opened.url,
      reason: error instanceof Error ? error.message : 'apply_failed',
      screenshotPath: shot.screenshotPath,
    };
  }
}
