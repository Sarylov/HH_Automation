import type { PlaywrightConfig } from '../../config.js';
import { withPage } from '../../browser/context.js';
import { createLogger } from '../../logger.js';
import { captureFailureArtifacts } from '../../utils/screenshot.js';

const logger = createLogger('chat.read');

export type ChatMessageItem = {
  externalId?: string;
  role: 'employer' | 'applicant' | 'system';
  body: string;
  sentAt?: string;
};

export type ReadChatResult = {
  ok: boolean;
  externalId: string;
  url: string;
  employerName?: string;
  vacancyTitle?: string;
  messages: ChatMessageItem[];
  reason?: string;
  screenshotPath?: string;
};

function inferRole(
  text: string,
  className: string | null,
): 'employer' | 'applicant' | 'system' {
  const blob = `${className ?? ''} ${text}`.toLowerCase();
  if (/applicant|me|исходящ|вы:/.test(blob)) return 'applicant';
  if (/system|служебн|автоматическ/.test(blob)) return 'system';
  return 'employer';
}

/**
 * Reads messages for a negotiation/chat thread.
 */
export async function readChat(
  config: PlaywrightConfig,
  externalId: string,
): Promise<ReadChatResult> {
  const url = `${config.baseUrl}/applicant/negotiations/${externalId}`;

  try {
    return await withPage(config, async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      if (page.url().includes('/account/login')) {
        const { screenshotPath } = await captureFailureArtifacts(
          page,
          config.artifactsDir,
          'chat-read-auth',
        );
        return {
          ok: false,
          externalId,
          url,
          messages: [],
          reason: 'not_authenticated',
          screenshotPath,
        };
      }

      const employerName =
        (
          await page
            .locator(
              '[data-qa="negotiations-employer-name"], [data-qa="chat-title"], h1, h2',
            )
            .first()
            .innerText()
            .catch(() => undefined)
        )?.trim() ?? undefined;

      const vacancyTitle =
        (
          await page
            .locator('[data-qa="negotiations-vacancy-title"], a[href*="/vacancy/"]')
            .first()
            .innerText()
            .catch(() => undefined)
        )?.trim() ?? undefined;

      const bubbles = page.locator(
        '[data-qa="chatik-chat-message"], [data-qa="negotiation-message"], [class*="message"]',
      );
      const count = await bubbles.count();
      const messages: ChatMessageItem[] = [];

      for (let i = 0; i < Math.min(count, 80); i += 1) {
        const bubble = bubbles.nth(i);
        const body = (await bubble.innerText().catch(() => ''))?.trim();
        if (!body || body.length < 2) continue;

        const className = await bubble.getAttribute('class').catch(() => null);
        const dataQa = await bubble.getAttribute('data-qa').catch(() => null);
        const role = inferRole(`${dataQa ?? ''} ${body}`, className);
        const idAttr =
          (await bubble.getAttribute('data-message-id').catch(() => null)) ??
          (await bubble.getAttribute('id').catch(() => null)) ??
          undefined;

        messages.push({
          externalId: idAttr ?? `${externalId}-${i}-${body.slice(0, 24)}`,
          role,
          body: body.slice(0, 4000),
        });
      }

      // Fallback: if no structured bubbles, use page text preview
      if (messages.length === 0) {
        const fallback = (
          await page
            .locator('main, [data-qa="chatik"], body')
            .first()
            .innerText()
            .catch(() => '')
        )
          ?.trim()
          .slice(0, 1500);
        if (fallback) {
          messages.push({
            role: 'employer',
            body: fallback,
            externalId: `${externalId}-fallback`,
          });
        }
      }

      logger.info('Chat read', { externalId, messages: messages.length });
      return {
        ok: true,
        externalId,
        url,
        employerName,
        vacancyTitle,
        messages,
      };
    });
  } catch (error) {
    logger.error('Read chat failed', { externalId, error });
    return {
      ok: false,
      externalId,
      url,
      messages: [],
      reason: error instanceof Error ? error.message : 'read_chat_failed',
    };
  }
}
