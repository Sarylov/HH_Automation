import type { PlaywrightConfig } from '../../config.js';
import { withPage } from '../../browser/context.js';
import { createLogger } from '../../logger.js';
import { captureFailureArtifacts } from '../../utils/screenshot.js';

const logger = createLogger('resume.list');

export type ResumeListItem = {
  externalId: string;
  title?: string;
  url: string;
};

export type ListResumesResult = {
  ok: boolean;
  items: ResumeListItem[];
  reason?: string;
  screenshotPath?: string;
};

/**
 * Lists applicant resumes from /applicant/resumes. Browser-only — no filtering.
 */
export async function listResumes(
  config: PlaywrightConfig,
): Promise<ListResumesResult> {
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
          'resume-list-auth',
        );
        return {
          ok: false,
          items: [],
          reason: 'not_authenticated',
          screenshotPath,
        };
      }

      const links = page.locator('a[href*="/resume/"]');
      const count = await links.count();
      const seen = new Set<string>();
      const items: ResumeListItem[] = [];

      for (let i = 0; i < count; i += 1) {
        const link = links.nth(i);
        const href = await link.getAttribute('href').catch(() => null);
        if (!href) continue;

        const match = href.match(/\/resume\/([a-f0-9]+)/i);
        if (!match) continue;
        const externalId = match[1];
        if (seen.has(externalId)) continue;
        seen.add(externalId);

        const title = (await link.innerText().catch(() => ''))?.trim() || undefined;
        const absoluteUrl = href.startsWith('http')
          ? href
          : `${config.baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;

        items.push({
          externalId,
          title,
          url: absoluteUrl.split('?')[0] ?? absoluteUrl,
        });
      }

      logger.info('Resumes listed', { count: items.length });
      return { ok: true, items };
    });
  } catch (error) {
    logger.error('List resumes failed', { error });
    return {
      ok: false,
      items: [],
      reason: error instanceof Error ? error.message : 'list_failed',
    };
  }
}
