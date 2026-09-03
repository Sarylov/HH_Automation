import type { Locator } from 'playwright';
import type { PlaywrightConfig } from '../../config.js';
import { withPage } from '../../browser/context.js';
import { createLogger } from '../../logger.js';
import { humanDelay } from '../../utils/human-delay.js';
import { captureFailureArtifacts } from '../../utils/screenshot.js';

const logger = createLogger('resume.raise-profile');

const PROFILE_PATH = '/applicant/profile/me';
const RAISE_BUTTON = '[data-qa~="resume-update-button"]';
const COOLDOWN_NOTICE = '[data-qa="resume-recommendation-text-updateResume"]';
const CONFIRM_TIMEOUT_MS = 15_000;

export type RaiseProfileResumeInput = {
  dryRun?: boolean;
};

export type RaiseProfileResumeResult = {
  ok: boolean;
  url: string;
  raised?: boolean;
  skipped?: boolean;
  dryRun?: boolean;
  reason?: string;
  /** Human-readable detail, e.g. the HH cooldown notice text. */
  message?: string;
  screenshotPath?: string;
};

async function readText(locator: Locator): Promise<string | undefined> {
  const raw = await locator.textContent().catch(() => null);
  return raw?.replace(/\s+/g, ' ').trim() || undefined;
}

/**
 * Raises the resume from the applicant profile page.
 * Executes DOM steps only — cooldown is reported back, not decided here.
 */
export async function raiseProfileResume(
  config: PlaywrightConfig,
  input: RaiseProfileResumeInput = {},
): Promise<RaiseProfileResumeResult> {
  const profileUrl = `${config.baseUrl}${PROFILE_PATH}`;

  try {
    return await withPage(config, async (page) => {
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded' });

      const url = page.url();
      if (url.includes('/account/login') || url.includes('/oauth')) {
        const { screenshotPath } = await captureFailureArtifacts(
          page,
          config.artifactsDir,
          'resume-raise-profile-auth',
        );
        return {
          ok: false,
          url,
          reason: 'not_authenticated',
          screenshotPath,
        };
      }

      const raiseButton = page.locator(RAISE_BUTTON).first();
      const cooldownNotice = page.locator(COOLDOWN_NOTICE).first();

      await raiseButton
        .or(cooldownNotice)
        .first()
        .waitFor({ state: 'visible', timeout: config.defaultTimeoutMs })
        .catch(() => undefined);

      if (!(await raiseButton.isVisible().catch(() => false))) {
        if (await cooldownNotice.isVisible().catch(() => false)) {
          const message = await readText(cooldownNotice);
          logger.info('Resume raise skipped — cooldown', { url, message });
          return {
            ok: true,
            url,
            raised: false,
            skipped: true,
            reason: 'raise_cooldown',
            message,
          };
        }

        const { screenshotPath } = await captureFailureArtifacts(
          page,
          config.artifactsDir,
          'resume-raise-profile-no-button',
        );
        return {
          ok: false,
          url,
          raised: false,
          reason: 'raise_button_not_found',
          screenshotPath,
        };
      }

      if (input.dryRun) {
        logger.info('Resume raise dry-run — no click', { url });
        return {
          ok: true,
          url,
          raised: false,
          dryRun: true,
          reason: 'dry_run',
        };
      }

      await humanDelay(300, 900);
      await raiseButton.click();

      const confirmed = await cooldownNotice
        .waitFor({ state: 'visible', timeout: CONFIRM_TIMEOUT_MS })
        .then(() => true)
        .catch(() => false);
      const buttonGone = !(await raiseButton.isVisible().catch(() => false));

      if (!confirmed && !buttonGone) {
        const { screenshotPath } = await captureFailureArtifacts(
          page,
          config.artifactsDir,
          'resume-raise-profile-unconfirmed',
        );
        return {
          ok: false,
          url,
          raised: false,
          reason: 'raise_not_confirmed',
          screenshotPath,
        };
      }

      const message = confirmed ? await readText(cooldownNotice) : undefined;
      logger.info('Resume raised from profile', { url, confirmed, message });
      return { ok: true, url, raised: true, message };
    });
  } catch (error) {
    logger.error('Resume raise from profile failed', { url: profileUrl, error });
    return {
      ok: false,
      url: profileUrl,
      reason: error instanceof Error ? error.message : 'raise_failed',
    };
  }
}
