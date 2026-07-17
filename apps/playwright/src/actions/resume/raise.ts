import type { PlaywrightConfig } from '../../config.js';
import { withPage } from '../../browser/context.js';
import { createLogger } from '../../logger.js';
import { humanDelay } from '../../utils/human-delay.js';
import { captureFailureArtifacts } from '../../utils/screenshot.js';

const logger = createLogger('resume.raise');

export type RaiseResumeInput = {
  dryRun?: boolean;
};

export type RaiseResumeResult = {
  ok: boolean;
  externalId: string;
  raised?: boolean;
  skipped?: boolean;
  dryRun?: boolean;
  reason?: string;
  screenshotPath?: string;
};

const RAISE_BUTTON = /поднять в поиске|поднять резюме|обновить дату/i;
const COOLDOWN = /через|доступно через|можно будет|осталось|уже поднято/i;

/**
 * Raises (bumps) a resume in search if the UI offers the action.
 * Does not decide whether raising is desirable — only executes DOM steps.
 */
export async function raiseResume(
  config: PlaywrightConfig,
  externalId: string,
  input: RaiseResumeInput = {},
): Promise<RaiseResumeResult> {
  try {
    return await withPage(config, async (page) => {
      await page.goto(`${config.baseUrl}/applicant/resumes`, {
        waitUntil: 'domcontentloaded',
      });

      const url = page.url();
      if (url.includes('/account/login') || url.includes('/oauth')) {
        const { screenshotPath } = await captureFailureArtifacts(
          page,
          config.artifactsDir,
          'resume-raise-auth',
        );
        return {
          ok: false,
          externalId,
          reason: 'not_authenticated',
          screenshotPath,
        };
      }

      const resumeLink = page.locator(`a[href*="/resume/${externalId}"]`).first();
      const linkVisible = await resumeLink.isVisible().catch(() => false);
      if (!linkVisible) {
        return {
          ok: false,
          externalId,
          reason: 'resume_not_found',
        };
      }

      // Scope to the nearest resume card / row containing this link
      const card = resumeLink.locator(
        'xpath=ancestor::*[contains(@data-qa,"resume") or contains(@class,"resume") or self::div][1]',
      );
      const scope = (await card.count()) > 0 ? card.first() : page;

      const raiseBtn = scope.getByRole('button', { name: RAISE_BUTTON }).first();
      const raiseLink = scope.getByRole('link', { name: RAISE_BUTTON }).first();
      const raiseVisible =
        (await raiseBtn.isVisible().catch(() => false)) ||
        (await raiseLink.isVisible().catch(() => false));

      if (!raiseVisible) {
        const cooldownText = await scope
          .getByText(COOLDOWN)
          .first()
          .isVisible()
          .catch(() => false);

        return {
          ok: true,
          externalId,
          raised: false,
          skipped: true,
          reason: cooldownText ? 'raise_cooldown' : 'raise_unavailable',
        };
      }

      if (input.dryRun) {
        logger.info('Raise dry-run — no click', { externalId });
        return {
          ok: true,
          externalId,
          raised: false,
          dryRun: true,
          reason: 'dry_run',
        };
      }

      await humanDelay(300, 900);
      if (await raiseBtn.isVisible().catch(() => false)) {
        await raiseBtn.click();
      } else {
        await raiseLink.click();
      }

      // Confirm dialog if present
      const confirm = page.getByRole('button', {
        name: /поднять|подтвердить|да/i,
      });
      if (await confirm.first().isVisible().catch(() => false)) {
        await humanDelay(200, 600);
        await confirm.first().click();
      }

      await page
        .getByText(/поднято|обновлено|в поиске/i)
        .first()
        .waitFor({ state: 'visible', timeout: 10_000 })
        .catch(() => undefined);

      logger.info('Resume raise attempted', { externalId });
      return {
        ok: true,
        externalId,
        raised: true,
      };
    });
  } catch (error) {
    logger.error('Raise resume failed', { externalId, error });
    const shot = await withPage(config, async (page) => {
      await page
        .goto(`${config.baseUrl}/applicant/resumes`, {
          waitUntil: 'domcontentloaded',
        })
        .catch(() => undefined);
      return captureFailureArtifacts(page, config.artifactsDir, 'resume-raise');
    }).catch(() => ({ screenshotPath: undefined }));

    return {
      ok: false,
      externalId,
      reason: error instanceof Error ? error.message : 'raise_failed',
      screenshotPath: shot.screenshotPath,
    };
  }
}
