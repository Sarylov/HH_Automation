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

/** Max wait for mandatory letter modal right after apply click (ms). */
const APPLY_LETTER_MODAL_WAIT_MS = 10_000;

/** Max wait for relocation warning after apply click (ms). */
const RELOCATION_WARNING_WAIT_MS = 3_000;
const RELOCATION_WARNING_POLL_MS = 300;

/** Max wait for post-apply "attach cover letter" on vacancy page (ms). */
const VACANCY_ATTACH_WAIT_MS = 15_000;
const VACANCY_ATTACH_POLL_MS = 500;

const VACANCY_ATTACH_COVER_LETTER_LABEL = /приложить\s+сопроводительное\s+письмо/i;
const COVER_LETTER_TEXTAREA_SELECTOR =
  'textarea[data-qa="vacancy-response-popup-form-letter-input"]';

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

function coverLetterTextareaLocator(page: Page): Locator {
  return page.locator(COVER_LETTER_TEXTAREA_SELECTOR);
}

async function isCoverLetterModalTextareaVisible(page: Page): Promise<boolean> {
  return (await firstVisible(coverLetterTextareaLocator(page))) !== null;
}

async function waitForChatButton(page: Page): Promise<boolean> {
  const deadline = Date.now() + CHAT_WAIT_MS;
  while (Date.now() < deadline) {
    if (await isChatVisible(page)) return true;
    await page.waitForTimeout(CHAT_POLL_MS);
  }
  return false;
}

async function isApplyConfirmed(page: Page): Promise<boolean> {
  if (await isChatVisible(page)) return true;
  const state = await detectVacancyResponseState(page);
  return state.alreadyApplied;
}

async function detectManualStepsInModal(page: Page): Promise<string | null> {
  const modal = page.locator('[role="dialog"]');
  const modalVisible = await modal
    .first()
    .isVisible()
    .catch(() => false);
  const scope = modalVisible ? modal.first() : page.locator('body');

  const employerTest = await scope
    .locator('[data-qa="employer-asking-for-test"], [data-qa="task-body"]')
    .first()
    .isVisible()
    .catch(() => false);
  if (employerTest) {
    const testRequired = await scope
      .locator('input[name="testRequired"][value="true"]')
      .first()
      .count()
      .catch(() => 0);
    if (testRequired > 0) return 'test_required';
    return 'questionnaire_required';
  }

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

/** Resume-only popup — skip when cover letter modal is open. */
async function submitResumePopupIfVisible(page: Page): Promise<void> {
  if (await isApplyCoverLetterModalOpen(page)) return;

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

/**
 * «Вы откликаетесь на вакансию в другой стране» — confirm and continue apply.
 * Returns true if the warning was present and confirmed.
 */
async function dismissRelocationWarningIfVisible(page: Page): Promise<boolean> {
  const confirmLocator = page
    .locator('[data-qa="relocation-warning-confirm"]')
    .or(page.getByRole('button', { name: /все\s+равно\s+откликнуться/i }));

  const deadline = Date.now() + RELOCATION_WARNING_WAIT_MS;
  let confirmBtn: Locator | null = null;
  while (Date.now() < deadline) {
    confirmBtn = await firstVisible(confirmLocator);
    if (confirmBtn) break;
    await page.waitForTimeout(RELOCATION_WARNING_POLL_MS);
  }
  if (!confirmBtn) return false;

  logger.info('Relocation warning — confirming apply');
  await confirmBtn.click();
  await humanDelay(300, 700);
  return true;
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

async function isApplyCoverLetterModalOpen(page: Page): Promise<boolean> {
  if (await isCoverLetterModalTextareaVisible(page)) return true;

  const applySubmit = await firstVisible(
    page.locator('[data-qa="vacancy-response-submit-popup"]'),
  );
  if (applySubmit) return true;

  const title = page.locator('[data-qa="title"]');
  const titleText =
    (await title
      .first()
      .textContent()
      .catch(() => null)) ?? '';
  return /отклик\s+на\s+вакансию/i.test(titleText);
}

async function waitForCoverLetterModalTextarea(
  page: Page,
  timeoutMs: number,
  externalId?: string,
): Promise<Locator | null> {
  const deadline = Date.now() + timeoutMs;
  const locator = coverLetterTextareaLocator(page);
  let toggleAttempted = false;

  while (Date.now() < deadline) {
    const textarea = await firstVisible(locator);
    if (textarea) return textarea;

    const modalOpen = await isApplyCoverLetterModalOpen(page);
    if (modalOpen && !toggleAttempted && externalId) {
      toggleAttempted = true;
      const expanded = await ensureCoverLetterTextareaVisible(page, externalId);
      if (expanded) return expanded;
    }

    await page.waitForTimeout(300);
  }
  return null;
}

async function ensureCoverLetterTextareaVisible(
  page: Page,
  externalId: string,
): Promise<Locator | null> {
  let textarea = await firstVisible(coverLetterTextareaLocator(page));
  if (textarea) return textarea;

  const toggle = await firstVisible(
    page.locator('[data-qa="vacancy-response-letter-toggle"]'),
  );
  if (toggle) {
    logger.info('Expanding cover letter section via toggle', { externalId });
    await toggle.click();
    await humanDelay(300, 700);
    textarea = await firstVisible(coverLetterTextareaLocator(page));
  }
  return textarea;
}

async function findCoverLetterModalSubmit(page: Page): Promise<Locator | null> {
  const applySubmit = page.locator('[data-qa="vacancy-response-submit-popup"]');
  const applyMatch = await firstVisible(applySubmit);
  if (applyMatch) return applyMatch;

  const letterSubmit = page.locator('[data-qa="vacancy-response-letter-submit"]');
  const letterMatch = await firstVisible(letterSubmit);
  if (letterMatch) return letterMatch;

  const dialog = page.locator('[role="dialog"]');
  return (
    (await firstVisible(
      dialog.getByRole('button', { name: /^отправить$/i }),
    )) ??
    (await firstVisible(
      dialog.getByRole('button', { name: /^откликнуться$/i }),
    ))
  );
}

async function waitForSubmitEnabled(
  submitBtn: Locator,
  timeoutMs = 8_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const disabled = await submitBtn.isDisabled().catch(() => true);
    if (!disabled) return true;
    await submitBtn.page().waitForTimeout(200);
  }
  return !(await submitBtn.isDisabled().catch(() => true));
}

async function confirmCoverLetterModalSubmitted(page: Page): Promise<boolean> {
  const textarea = coverLetterTextareaLocator(page);
  const applySubmit = page.locator('[data-qa="vacancy-response-submit-popup"]');
  const letterSubmit = page.locator('[data-qa="vacancy-response-letter-submit"]');
  const dialog = page.locator('[role="dialog"]');

  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    if (await isChatVisible(page)) return true;

    const dialogVisible = await dialog
      .first()
      .isVisible()
      .catch(() => false);
    const textareaVisible = await textarea
      .first()
      .isVisible()
      .catch(() => false);
    const applySubmitVisible = await applySubmit
      .first()
      .isVisible()
      .catch(() => false);
    const letterSubmitVisible = await letterSubmit
      .first()
      .isVisible()
      .catch(() => false);

    if (!dialogVisible && !textareaVisible && !applySubmitVisible && !letterSubmitVisible) {
      return true;
    }
    await page.waitForTimeout(400);
  }
  return false;
}

async function fillAndSubmitCoverLetterModal(
  page: Page,
  coverLetter: string,
  externalId: string,
  artifactsDir: string,
  artifactPrefix: string,
): Promise<{ attached: boolean; reason: string; screenshotPath?: string }> {
  const textarea =
    (await ensureCoverLetterTextareaVisible(page, externalId)) ??
    (await waitForCoverLetterModalTextarea(page, 8_000));

  if (!textarea) {
    const screenshot = await captureFailureArtifacts(
      page,
      artifactsDir,
      `${artifactPrefix}-textarea-${externalId}`,
    ).catch(() => ({ screenshotPath: undefined }));
    logger.warn('Cover letter modal textarea not visible', {
      externalId,
      artifactPrefix,
      screenshotPath: screenshot.screenshotPath,
    });
    return {
      attached: false,
      reason: 'cover_letter_attach_failed',
      screenshotPath: screenshot.screenshotPath,
    };
  }

  await textarea.fill(coverLetter);
  logger.info('Cover letter filled in modal textarea', { externalId, artifactPrefix });
  await humanDelay(200, 500);

  const submitBtn = await findCoverLetterModalSubmit(page);
  if (!submitBtn) {
    const screenshot = await captureFailureArtifacts(
      page,
      artifactsDir,
      `${artifactPrefix}-submit-${externalId}`,
    ).catch(() => ({ screenshotPath: undefined }));
    logger.warn('Cover letter modal submit button not found', {
      externalId,
      artifactPrefix,
      screenshotPath: screenshot.screenshotPath,
    });
    return {
      attached: false,
      reason: 'cover_letter_attach_failed',
      screenshotPath: screenshot.screenshotPath,
    };
  }

  const enabled = await waitForSubmitEnabled(submitBtn);
  if (!enabled) {
    logger.warn('Cover letter modal submit button stayed disabled', {
      externalId,
      artifactPrefix,
    });
  }

  await submitBtn.click();
  logger.info('Cover letter modal submit clicked', {
    externalId,
    artifactPrefix,
    submitQa:
      (await submitBtn.getAttribute('data-qa').catch(() => null)) ?? 'unknown',
  });

  const submitted = await confirmCoverLetterModalSubmitted(page);
  if (submitted) {
    logger.info('Cover letter modal closed after submit', { externalId, artifactPrefix });
    return { attached: true, reason: 'cover_letter_sent_via_modal' };
  }

  const screenshot = await captureFailureArtifacts(
    page,
    artifactsDir,
    `${artifactPrefix}-send-${externalId}`,
  ).catch(() => ({ screenshotPath: undefined }));
  logger.warn('Cover letter modal still open after submit', {
    externalId,
    artifactPrefix,
    screenshotPath: screenshot.screenshotPath,
  });
  return {
    attached: false,
    reason: 'cover_letter_attach_failed',
    screenshotPath: screenshot.screenshotPath,
  };
}

type PostClickPopupResult = {
  letterHandled: boolean;
  needsManual?: boolean;
  attached?: boolean;
  reason?: string;
  screenshotPath?: string;
};

/**
 * After «Откликнуться» (and optional relocation confirm): handle resume popup,
 * then mandatory cover-letter modal if HH opens it.
 */
async function tryHandlePostClickPopups(
  page: Page,
  coverLetter: string | undefined,
  externalId: string,
  artifactsDir: string,
): Promise<PostClickPopupResult> {
  const manualInModal = await detectManualStepsInModal(page);
  if (manualInModal) {
    logger.info('Manual steps detected in response modal', {
      externalId,
      reason: manualInModal,
    });
    return {
      letterHandled: true,
      needsManual: true,
      reason: manualInModal,
    };
  }

  let textarea = await waitForCoverLetterModalTextarea(
    page,
    APPLY_LETTER_MODAL_WAIT_MS,
    externalId,
  );

  if (!textarea && !(await isApplyCoverLetterModalOpen(page))) {
    await submitResumePopupIfVisible(page);
    await humanDelay(300, 500);
    textarea = await waitForCoverLetterModalTextarea(page, 4_000, externalId);
  } else if (!textarea) {
    textarea = await waitForCoverLetterModalTextarea(page, 4_000, externalId);
  }

  if (!textarea) {
    return { letterHandled: false };
  }

  logger.info('Mandatory cover letter modal detected after apply click', {
    externalId,
  });

  if (!coverLetter) {
    return {
      letterHandled: true,
      needsManual: true,
      reason: 'cover_letter_required_in_apply_modal',
    };
  }

  const result = await fillAndSubmitCoverLetterModal(
    page,
    coverLetter,
    externalId,
    artifactsDir,
    'apply-mandatory-letter',
  );

  if (!result.attached) {
    return {
      letterHandled: true,
      needsManual: true,
      reason: result.reason,
      screenshotPath: result.screenshotPath,
    };
  }

  return {
    letterHandled: true,
    attached: true,
    reason: 'cover_letter_sent_in_apply_modal',
  };
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

  const result = await fillAndSubmitCoverLetterModal(
    page,
    coverLetter,
    externalId,
    artifactsDir,
    'apply-cover-letter',
  );
  if (result.attached) {
    return { attached: true, reason: 'cover_letter_sent_via_modal' };
  }
  return result;
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

      const letter = input.coverLetter?.trim();

      await humanDelay(400, 1_200);
      await applyButton.click();
      await humanDelay(300, 700);

      const relocationConfirmed = await dismissRelocationWarningIfVisible(page);
      if (relocationConfirmed) {
        logger.info('Relocation warning confirmed', { externalId });
      }

      const popupResult = await tryHandlePostClickPopups(
        page,
        letter,
        externalId,
        config.artifactsDir,
      );

      if (popupResult.needsManual) {
        return {
          ok: false,
          externalId,
          url,
          needsManual: true,
          reason: popupResult.reason ?? 'cover_letter_required_in_apply_modal',
          screenshotPath: popupResult.screenshotPath,
        };
      }

      if (!popupResult.letterHandled) {
        await submitResumePopupIfVisible(page);
      }

      const applyConfirmed = await isApplyConfirmed(page)
        ? true
        : await waitForChatButton(page).then(
            (chat) => chat || isApplyConfirmed(page),
          );

      if (!applyConfirmed) {
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

      logger.info('Apply confirmed', { externalId });

      if (popupResult.letterHandled && popupResult.attached) {
        return {
          ok: true,
          externalId,
          url,
          applied: true,
          coverLetterAttached: true,
          reason: popupResult.reason ?? 'cover_letter_sent_in_apply_modal',
        };
      }

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
