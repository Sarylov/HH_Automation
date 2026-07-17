import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { PlaywrightConfig } from '../../config.js';
import { withPage } from '../../browser/context.js';
import { createLogger } from '../../logger.js';
import { captureFailureArtifacts } from '../../utils/screenshot.js';

const logger = createLogger('auth.login');

export type LoginResult = {
  ok: boolean;
  implemented: boolean;
  reason: string;
  storageStatePath?: string;
  screenshotPath?: string;
};

/**
 * Login skeleton only — full HH login (captcha/2FA) comes later.
 * When credentials are provided, attempts form fill and saves storageState if resumes open.
 */
export async function loginSkeleton(
  config: PlaywrightConfig,
  credentials: { login?: string; password?: string },
): Promise<LoginResult> {
  if (!credentials.login || !credentials.password) {
    return {
      ok: false,
      implemented: false,
      reason:
        'credentials_missing — set HH_LOGIN/HH_PASSWORD or POST body; prefer manual storageState for now',
    };
  }

  try {
    return await withPage(
      config,
      async (page, context) => {
        await page.goto(`${config.baseUrl}/account/login`, {
          waitUntil: 'domcontentloaded',
        });

        const loginInput = page.locator(
          'input[name="username"], input[type="email"], input[type="tel"]',
        ).first();
        const passwordInput = page.locator('input[type="password"]').first();

        const hasForm =
          (await loginInput.count()) > 0 && (await passwordInput.count()) > 0;

        if (!hasForm) {
          const { screenshotPath } = await captureFailureArtifacts(
            page,
            config.artifactsDir,
            'login-form-missing',
          );
          return {
            ok: false,
            implemented: false,
            reason: 'login_form_not_found_or_blocked',
            screenshotPath,
          };
        }

        await loginInput.fill(credentials.login!);
        await passwordInput.fill(credentials.password!);

        const submit = page.getByRole('button', { name: /войти|продолжить/i }).first();
        if ((await submit.count()) > 0) {
          await submit.click();
        }

        await page.waitForLoadState('domcontentloaded');

        await mkdir(path.dirname(config.storageStatePath), { recursive: true });
        await context.storageState({ path: config.storageStatePath });
        logger.info('storageState saved (login skeleton)', {
          path: config.storageStatePath,
        });

        return {
          ok: true,
          implemented: true,
          reason: 'storage_state_saved_after_attempt — verify with GET /auth/status',
          storageStatePath: config.storageStatePath,
        };
      },
      { withStorageState: false },
    );
  } catch (error) {
    logger.error('Login skeleton failed', { error });
    return {
      ok: false,
      implemented: true,
      reason: error instanceof Error ? error.message : 'login_failed',
    };
  }
}
