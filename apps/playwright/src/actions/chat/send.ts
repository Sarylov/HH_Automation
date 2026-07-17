import type { PlaywrightConfig } from '../../config.js';
import { withPage } from '../../browser/context.js';
import { createLogger } from '../../logger.js';
import { humanDelay } from '../../utils/human-delay.js';
import { captureFailureArtifacts } from '../../utils/screenshot.js';

const logger = createLogger('chat.send');

export type SendChatInput = {
  text: string;
  dryRun?: boolean;
};

export type SendChatResult = {
  ok: boolean;
  externalId: string;
  url: string;
  sent?: boolean;
  dryRun?: boolean;
  reason?: string;
  screenshotPath?: string;
};

/**
 * Sends a text message in a negotiation chat. Browser-only — no business rules.
 */
export async function sendChatMessage(
  config: PlaywrightConfig,
  externalId: string,
  input: SendChatInput,
): Promise<SendChatResult> {
  const url = `${config.baseUrl}/applicant/negotiations/${externalId}`;
  const text = input.text.trim();
  if (!text) {
    return {
      ok: false,
      externalId,
      url,
      reason: 'empty_message',
    };
  }

  try {
    return await withPage(config, async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      if (page.url().includes('/account/login')) {
        const { screenshotPath } = await captureFailureArtifacts(
          page,
          config.artifactsDir,
          'chat-send-auth',
        );
        return {
          ok: false,
          externalId,
          url,
          reason: 'not_authenticated',
          screenshotPath,
        };
      }

      const textarea = page
        .locator(
          'textarea[data-qa="chatik-chat-input"], textarea[placeholder*="сообщение" i], textarea',
        )
        .first();
      const visible = await textarea.isVisible().catch(() => false);
      if (!visible) {
        return {
          ok: false,
          externalId,
          url,
          reason: 'chat_input_not_found',
        };
      }

      if (input.dryRun) {
        logger.info('Chat send dry-run', { externalId });
        return {
          ok: true,
          externalId,
          url,
          sent: false,
          dryRun: true,
          reason: 'dry_run',
        };
      }

      await humanDelay(300, 900);
      await textarea.fill(text);

      const sendBtn = page.getByRole('button', {
        name: /отправить|send/i,
      });
      if (await sendBtn.first().isVisible().catch(() => false)) {
        await sendBtn.first().click();
      } else {
        await textarea.press('Enter');
      }

      await page
        .getByText(text.slice(0, 40), { exact: false })
        .first()
        .waitFor({ state: 'visible', timeout: 10_000 })
        .catch(() => undefined);

      logger.info('Chat message sent', { externalId });
      return {
        ok: true,
        externalId,
        url,
        sent: true,
      };
    });
  } catch (error) {
    logger.error('Send chat failed', { externalId, error });
    const shot = await withPage(config, async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
      return captureFailureArtifacts(page, config.artifactsDir, 'chat-send');
    }).catch(() => ({ screenshotPath: undefined }));

    return {
      ok: false,
      externalId,
      url,
      reason: error instanceof Error ? error.message : 'send_chat_failed',
      screenshotPath: shot.screenshotPath,
    };
  }
}
