import type { Locator, Page } from 'playwright';
import type { PlaywrightConfig } from '../../config.js';
import { withPage } from '../../browser/context.js';
import { createLogger } from '../../logger.js';
import { humanDelay } from '../../utils/human-delay.js';
import { captureFailureArtifacts } from '../../utils/screenshot.js';
import { openVacancy } from './open.js';

const logger = createLogger('vacancies.apply');

/** Max wait for Chat button after clicking Apply (ms). */
const CHAT_WAIT_MS = 15_000;
const CHAT_POLL_MS = 500;

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
const ALREADY_APPLIED_TEXT = /вы\s*откликнулись|отклик\s*отправлен/i;

const MANUAL_STEP_PATTERNS =
  /пройдите\s+тест|пройти\s+тест|заполните\s+анкет|пройдите\s+анкет/i;

function chatButton(page: Page): Locator {
  return page
    .locator('[data-qa="vacancy-response-link-view-topic"]')
    .or(page.getByRole('link', { name: /^чат$/i }))
    .or(page.getByRole('button', { name: /^чат$/i }));
}

async function isChatVisible(page: Page): Promise<boolean> {
  return chatButton(page)
    .first()
    .isVisible()
    .catch(() => false);
}

async function isAlreadyApplied(page: Page): Promise<boolean> {
  const appliedText = await page
    .getByText(ALREADY_APPLIED_TEXT)
    .first()
    .isVisible()
    .catch(() => false);
  if (appliedText) return true;
  return isChatVisible(page);
}

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

function chatMessages(page: Page): Locator {
  return page.locator(
    '[data-qa="chatik-chat-message"], [data-qa="negotiation-message"]',
  );
}

async function attachCoverLetterViaChat(
  page: Page,
  coverLetter: string,
): Promise<{ attached: boolean; reason: string }> {
  const chat = chatButton(page).first();
  await chat.click();
  await humanDelay(400, 900);

  const attachBtn = page.locator('[data-qa="chatik-chat-message-applicant-action"]');
  const attachVisible = await attachBtn
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(() => true)
    .catch(() => false);

  if (!attachVisible) {
    return { attached: false, reason: 'cover_letter_attach_unavailable' };
  }

  const messagesBefore = await chatMessages(page).count();

  await attachBtn.first().click();
  await humanDelay(300, 700);

  const textarea = page.locator('textarea[data-qa="chatik-new-message-text"]').first();
  const inputVisible = await textarea
    .waitFor({ state: 'visible', timeout: 8_000 })
    .then(() => true)
    .catch(() => false);

  if (!inputVisible) {
    return { attached: false, reason: 'cover_letter_attach_failed' };
  }

  await textarea.fill(coverLetter);
  await humanDelay(200, 500);

  const sendBtn = page.getByRole('button', { name: /отправить|send/i });
  if (await sendBtn.first().isVisible().catch(() => false)) {
    await sendBtn.first().click();
  } else {
    await textarea.press('Enter');
  }

  const snippet = coverLetter.trim().slice(0, 80);
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    const count = await chatMessages(page).count();
    if (count > messagesBefore) {
      const hasText = await chatMessages(page)
        .filter({ hasText: snippet })
        .first()
        .isVisible()
        .catch(() => false);
      if (hasText) {
        return { attached: true, reason: 'cover_letter_sent_via_chat' };
      }
    }
    const directMatch = await page
      .getByText(snippet, { exact: false })
      .first()
      .isVisible()
      .catch(() => false);
    if (directMatch) {
      return { attached: true, reason: 'cover_letter_sent_via_chat' };
    }
    await page.waitForTimeout(400);
  }

  return { attached: false, reason: 'cover_letter_attach_failed' };
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

      if (await isAlreadyApplied(page)) {
        logger.info('Vacancy already applied — skip', { externalId });
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
        const manualReason = await detectManualStepsInModal(page);
        return {
          ok: false,
          externalId,
          url: opened.url,
          needsManual: manualReason !== null,
          reason: manualReason ?? 'apply_button_not_found',
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
      await submitResponsePopupIfVisible(page);

      const chatAppeared = await waitForChatButton(page);
      if (!chatAppeared) {
        const manualReason =
          (await detectManualStepsInModal(page)) ?? 'chat_not_available_after_apply';
        return {
          ok: false,
          externalId,
          url: opened.url,
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
          url: opened.url,
          applied: true,
          reason: 'cover_letter_skipped',
        };
      }

      const attachResult = await attachCoverLetterViaChat(page, letter);
      return {
        ok: true,
        externalId,
        url: opened.url,
        applied: true,
        coverLetterAttached: attachResult.attached,
        reason: attachResult.reason,
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
