import type { PlaywrightConfig } from '../../config.js';
import { withPage } from '../../browser/context.js';
import { createLogger } from '../../logger.js';
import { captureFailureArtifacts } from '../../utils/screenshot.js';

const logger = createLogger('chat.list');

export type ChatListItem = {
  externalId: string;
  url: string;
  employerName?: string;
  vacancyTitle?: string;
  preview?: string;
  unread?: boolean;
};

export type ListChatsResult = {
  ok: boolean;
  items: ChatListItem[];
  reason?: string;
  screenshotPath?: string;
};

/**
 * Lists applicant negotiations/chats from hh.ru UI.
 */
export async function listChats(
  config: PlaywrightConfig,
): Promise<ListChatsResult> {
  try {
    return await withPage(config, async (page) => {
      await page.goto(`${config.baseUrl}/applicant/negotiations`, {
        waitUntil: 'domcontentloaded',
      });

      const url = page.url();
      if (url.includes('/account/login') || url.includes('/oauth')) {
        const { screenshotPath } = await captureFailureArtifacts(
          page,
          config.artifactsDir,
          'chat-list-auth',
        );
        return {
          ok: false,
          items: [],
          reason: 'not_authenticated',
          screenshotPath,
        };
      }

      const cards = page.locator(
        '[data-qa="negotiations-item"], [data-qa="chatik-item"], a[href*="/applicant/negotiations/"]',
      );
      const count = await cards.count();
      const seen = new Set<string>();
      const items: ChatListItem[] = [];

      for (let i = 0; i < Math.min(count, 40); i += 1) {
        const card = cards.nth(i);
        const href =
          (await card.getAttribute('href').catch(() => null)) ??
          (await card
            .locator('a[href*="/applicant/negotiations/"]')
            .first()
            .getAttribute('href')
            .catch(() => null));

        if (!href) continue;
        const match = href.match(/\/applicant\/negotiations\/([^/?#]+)/i);
        if (!match) continue;
        const externalId = decodeURIComponent(match[1]);
        if (seen.has(externalId)) continue;
        seen.add(externalId);

        const absoluteUrl = href.startsWith('http')
          ? href
          : `${config.baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;

        const text = (await card.innerText().catch(() => ''))?.trim() ?? '';
        const lines = text
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);

        items.push({
          externalId,
          url: absoluteUrl.split('?')[0] ?? absoluteUrl,
          employerName: lines[0],
          vacancyTitle: lines[1],
          preview: lines.slice(2).join(' ').slice(0, 300) || undefined,
          unread: /непрочит|новое/i.test(text),
        });
      }

      logger.info('Chats listed', { count: items.length });
      return { ok: true, items };
    });
  } catch (error) {
    logger.error('List chats failed', { error });
    return {
      ok: false,
      items: [],
      reason: error instanceof Error ? error.message : 'list_chats_failed',
    };
  }
}
