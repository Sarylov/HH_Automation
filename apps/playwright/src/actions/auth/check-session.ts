import type { PlaywrightConfig } from '../../config.js';
import { storageStateExists, withPage } from '../../browser/context.js';
import { createLogger } from '../../logger.js';
import { captureFailureArtifacts } from '../../utils/screenshot.js';

const logger = createLogger('auth.check');

export type AuthCheckResult = {
  status: 'up' | 'down';
  storageStatePresent: boolean;
  checkedAt: string;
  url?: string;
  reason?: string;
  screenshotPath?: string;
};

/**
 * Browser-only session probe. No business decisions.
 * Heuristic: applicant area reachable / login CTA not dominant.
 */
export async function checkAuthSession(
  config: PlaywrightConfig,
): Promise<AuthCheckResult> {
  const checkedAt = new Date().toISOString();
  const storageStatePresent = await storageStateExists(config.storageStatePath);

  if (!storageStatePresent) {
    return {
      status: 'down',
      storageStatePresent: false,
      checkedAt,
      reason: 'storage_state_missing',
    };
  }

  try {
    return await withPage(config, async (page) => {
      await page.goto(`${config.baseUrl}/applicant/resumes`, {
        waitUntil: 'domcontentloaded',
      });

      const url = page.url();
      const loginVisible = await page
        .getByRole('button', { name: /войти/i })
        .first()
        .isVisible()
        .catch(() => false);
      const onLoginPath =
        url.includes('/account/login') || url.includes('/oauth');

      if (onLoginPath || loginVisible) {
        const { screenshotPath } = await captureFailureArtifacts(
          page,
          config.artifactsDir,
          'auth-down',
        );
        return {
          status: 'down' as const,
          storageStatePresent: true,
          checkedAt,
          url,
          reason: 'redirected_to_login',
          screenshotPath,
        };
      }

      logger.info('Session check OK', { url });
      return {
        status: 'up' as const,
        storageStatePresent: true,
        checkedAt,
        url,
      };
    });
  } catch (error) {
    logger.error('Session check failed', { error });
    return {
      status: 'down',
      storageStatePresent,
      checkedAt,
      reason: error instanceof Error ? error.message : 'check_failed',
    };
  }
}
