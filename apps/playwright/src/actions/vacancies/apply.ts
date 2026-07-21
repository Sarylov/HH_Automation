import type { Locator, Page } from 'playwright';
import type { PlaywrightConfig } from '../../config.js';
import { withPage } from '../../browser/context.js';
import { createLogger } from '../../logger.js';
import { humanDelay } from '../../utils/human-delay.js';
import { captureFailureArtifacts } from '../../utils/screenshot.js';
import {
  detectVacancyResponseState,
  firstVisible,
  isChatVisible,
} from './vacancy-response-state.js';

const logger = createLogger('vacancies.apply');

function vacancyUrl(config: PlaywrightConfig, externalId: string): string {
  return `${config.baseUrl}/vacancy/${externalId}`;
}

/** Max wait for Chat button after clicking Apply (ms). */
const CHAT_WAIT_MS = 15_000;
const CHAT_POLL_MS = 500;

/** Max wait for post-apply "attach cover letter" on vacancy page (ms). */
const VACANCY_ATTACH_WAIT_MS = 15_000;
const VACANCY_ATTACH_POLL_MS = 500;

const VACANCY_ATTACH_COVER_LETTER_LABEL = /приложить\s+сопроводительное\s+письмо/i;

export type ApplyVacancyInput = {
  coverLetter?: string;
  dryRun?: boolean;
};

export type ApplyVacancyResult = {
  ok: boolean;
  externalId: string;
  url: string;
  applied?: boolean;
  coverLetterAttached?: boolean;
  needsManual?: boolean;
  dryRun?: boolean;
  alreadyApplied?: boolean;
  reason?: string;
  screenshotPath?: string;
};

const APPLY_BUTTON = /откликнуться|отклик/i;

const MANUAL_STEP_PATTERNS =
  /пройдите\s+тест|пройти\s+тест|заполните\s+анкет|пройдите\s+анкет/i;

async function waitForChatButton(page: Page): Promise<boolean> {
  const deadline = Date.now() + CHAT_WAIT_MS;
  while (Date.now() < deadline) {
    if (await isChatVisible(page)) return true;
    await page.waitForTimeout(CHAT_POLL_MS);
  }
  return false;
}

async function detectManualStepsInModal(page: Page): Promise<string | null> {
  const modal = page.locator(
    '[data-qa="vacancy-response-popup"], [data-qa="vacancy-response-popup-form"], [role="dialog"]',
  );
  const modalVisible = await modal
    .first()
    .isVisible()
    .catch(() => false);
  const scope = modalVisible ? modal.first() : page.locator('body');

  const testVisible = await scope
    .getByText(MANUAL_STEP_PATTERNS)
    .first()
    .isVisible()
    .catch(() => false);
  if (testVisible) {
    const text =
      (await scope
        .getByText(MANUAL_STEP_PATTERNS)
        .first()
        .textContent()
        .catch(() => null)) ?? '';
    if (/анкет/i.test(text)) return 'questionnaire_required';
    return 'test_required';
  }
  return null;
}

async function submitResponsePopupIfVisible(page: Page): Promise<void> {
  const popup = page.locator(
    '[data-qa="vacancy-response-popup"], [data-qa="vacancy-response-popup-form"]',
  );
  const popupVisible = await popup
    .first()
    .isVisible()
    .catch(() => false);
  if (!popupVisible) return;

  const submit = page.getByRole('button', {
    name: /отправить|откликнуться/i,
  });
  if (await submit.first().isVisible().catch(() => false)) {
    await submit.first().click();
    await humanDelay(300, 700);
  }
}

async function findVisibleVacancyAttachButton(page: Page): Promise<Locator | null> {
  const byQa = page.locator('[data-qa="responded-success-attach-cover-letter"]');
  const qaMatch = await firstVisible(byQa);
  if (qaMatch) return qaMatch;

  const byText = page.getByRole('button', { name: VACANCY_ATTACH_COVER_LETTER_LABEL });
  return firstVisible(byText);
}

async function countVacancyAttachCandidates(page: Page): Promise<number> {
  return page.locator('[data-qa="responded-success-attach-cover-letter"]').count();
}

async function waitForVisibleVacancyAttachButton(
  page: Page,
): Promise<Locator | null> {
  const deadline = Date.now() + VACANCY_ATTACH_WAIT_MS;
  while (Date.now() < deadline) {
    const button = await findVisibleVacancyAttachButton(page);
    if (button) return button;
    await page.waitForTimeout(VACANCY_ATTACH_POLL_MS);
  }
  return null;
}

async function waitForCoverLetterModalTextarea(page: Page): Promise<Locator | null> {
  const deadline = Date.now() + 10_000;
  const locator = page.locator(
    'textarea[data-qa="vacancy-response-popup-form-letter-input"]',
  );
  while (Date.now() < deadline) {
    const textarea = await firstVisible(locator);
    if (textarea) return textarea;
    await page.waitForTimeout(300);
  }
  return null;
}

async function confirmCoverLetterModalSubmitted(page: Page): Promise<boolean> {
  const textarea = page.locator(
    'textarea[data-qa="vacancy-response-popup-form-letter-input"]',
  );
  const submit = page.locator('[data-qa="vacancy-response-letter-submit"]');

  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    const textareaVisible = await textarea
      .first()
      .isVisible()
      .catch(() => false);
    const submitVisible = await submit
      .first()
      .isVisible()
      .catch(() => false);
    if (!textareaVisible && !submitVisible) {
      return true;
    }
    await page.waitForTimeout(400);
  }
  return false;
}

async function attachCoverLetterViaVacancyModal(
  page: Page,
  coverLetter: string,
  externalId: string,
  artifactsDir: string,
): Promise<{ attached: boolean; reason: string; screenshotPath?: string }> {
  logger.info('Attaching cover letter via vacancy modal', {
    externalId,
    letterLength: coverLetter.length,
  });

  const candidateCount = await countVacancyAttachCandidates(page);
  logger.info('Waiting for post-apply attach cover letter button', {
    externalId,
    candidateCount,
  });

  const attachBtn = await waitForVisibleVacancyAttachButton(page);
  if (!attachBtn) {
    const screenshot = await captureFailureArtifacts(
      page,
      artifactsDir,
      `apply-cover-letter-unavailable-${externalId}`,
    ).catch(() => ({ screenshotPath: undefined }));
    logger.warn('Vacancy attach cover letter button not visible', {
      externalId,
      candidateCount,
      waitedMs: VACANCY_ATTACH_WAIT_MS,
      screenshotPath: screenshot.screenshotPath,
    });
    return {
      attached: false,
      reason: 'cover_letter_attach_unavailable',
      screenshotPath: screenshot.screenshotPath,
    };
  }

  logger.info('Vacancy attach cover letter button found', { externalId });
  await attachBtn.scrollIntoViewIfNeeded().catch(() => undefined);
  await attachBtn.click();
  logger.info('Clicked vacancy attach cover letter button', { externalId });
  await humanDelay(300, 700);

  const textarea = await waitForCoverLetterModalTextarea(page);
  if (!textarea) {
    const screenshot = await captureFailureArtifacts(
      page,
      artifactsDir,
      `apply-cover-letter-textarea-${externalId}`,
    ).catch(() => ({ screenshotPath: undefined }));
    logger.warn('Cover letter modal textarea not visible', {
      externalId,
      screenshotPath: screenshot.screenshotPath,
    });
    return {
      attached: false,
      reason: 'cover_letter_attach_failed',
      screenshotPath: screenshot.screenshotPath,
    };
  }

  await textarea.fill(coverLetter);
  logger.info('Cover letter filled in modal textarea', { externalId });
  await humanDelay(200, 500);

  const submitBtn =
    (await firstVisible(page.locator('[data-qa="vacancy-response-letter-submit"]'))) ??
    (await firstVisible(
      page.getByRole('button', { name: /^отправить$/i }),
    ));

  if (!submitBtn) {
    const screenshot = await captureFailureArtifacts(
      page,
      artifactsDir,
      `apply-cover-letter-submit-${externalId}`,
    ).catch(() => ({ screenshotPath: undefined }));
    logger.warn('Cover letter modal submit button not found', {
      externalId,
      screenshotPath: screenshot.screenshotPath,
    });
    return {
      attached: false,
      reason: 'cover_letter_attach_failed',
      screenshotPath: screenshot.screenshotPath,
    };
  }

  await submitBtn.click();
  logger.info('Cover letter modal submit clicked', { externalId });

  const submitted = await confirmCoverLetterModalSubmitted(page);
  if (submitted) {
    logger.info('Cover letter modal closed after submit', { externalId });
    return { attached: true, reason: 'cover_letter_sent_via_modal' };
  }

  const screenshot = await captureFailureArtifacts(
    page,
    artifactsDir,
    `apply-cover-letter-send-${externalId}`,
  ).catch(() => ({ screenshotPath: undefined }));
  logger.warn('Cover letter modal still open after submit', {
    externalId,
    screenshotPath: screenshot.screenshotPath,
  });
  return {
    attached: false,
    reason: 'cover_letter_attach_failed',
    screenshotPath: screenshot.screenshotPath,
  };
}

export async function applyToVacancy(
  config: PlaywrightConfig,
  externalId: string,
  input: ApplyVacancyInput = {},
): Promise<ApplyVacancyResult> {
  const url = vacancyUrl(config, externalId);

  try {
    return await withPage(config, async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const responseState = await detectVacancyResponseState(page);
      if (responseState.alreadyApplied) {
        logger.info('Vacancy already applied — skip', {
          externalId,
          reason: responseState.reason,
        });
        return {
          ok: true,
          externalId,
          url,
          applied: true,
          alreadyApplied: true,
          reason: responseState.reason ?? 'already_applied',
        };
      }

      const applyButton = page.getByRole('button', { name: APPLY_BUTTON }).first();
      const applyVisible = await applyButton.isVisible().catch(() => false);
      if (!applyVisible) {
        const manualReason = await detectManualStepsInModal(page);
        return {
          ok: false,
          externalId,
          url,
          needsManual: manualReason !== null,
          reason: manualReason ?? 'apply_button_not_found',
        };
      }

      if (input.dryRun) {
        logger.info('Apply dry-run — no click', { externalId });
        return {
          ok: true,
          externalId,
          url,
          applied: false,
          dryRun: true,
          reason: 'dry_run',
        };
      }

      await humanDelay(400, 1_200);
      await applyButton.click();
      await submitResponsePopupIfVisible(page);

      const chatAppeared = await waitForChatButton(page);
      if (!chatAppeared) {
        const manualReason =
          (await detectManualStepsInModal(page)) ?? 'chat_not_available_after_apply';
        return {
          ok: false,
          externalId,
          url,
          needsManual: true,
          reason: manualReason,
        };
      }

      logger.info('Apply confirmed via Chat button', { externalId });

      const letter = input.coverLetter?.trim();
      if (!letter) {
        return {
          ok: true,
          externalId,
          url,
          applied: true,
          reason: 'cover_letter_skipped',
        };
      }

      const attachResult = await attachCoverLetterViaVacancyModal(
        page,
        letter,
        externalId,
        config.artifactsDir,
      );
      if (attachResult.screenshotPath) {
        logger.info('Cover letter attach artifact saved', {
          externalId,
          screenshotPath: attachResult.screenshotPath,
          reason: attachResult.reason,
        });
      }
      return {
        ok: true,
        externalId,
        url,
        applied: true,
        coverLetterAttached: attachResult.attached,
        reason: attachResult.reason,
        screenshotPath: attachResult.screenshotPath,
      };
    });
  } catch (error) {
    logger.error('Apply failed', { externalId, error });
    const shot = await withPage(config, async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
      return captureFailureArtifacts(page, config.artifactsDir, 'apply');
    }).catch(() => ({ screenshotPath: undefined }));

    return {
      ok: false,
      externalId,
      url,
      reason: error instanceof Error ? error.message : 'apply_failed',
      screenshotPath: shot.screenshotPath,
    };
  }
}
