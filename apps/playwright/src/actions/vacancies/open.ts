import type { PlaywrightConfig } from '../../config.js';
import { withPage } from '../../browser/context.js';
import { createLogger } from '../../logger.js';
import { captureFailureArtifacts } from '../../utils/screenshot.js';

const logger = createLogger('vacancies.open');

export type OpenVacancyResult = {
  ok: boolean;
  externalId: string;
  url: string;
  title?: string;
  company?: string;
  descriptionSnippet?: string;
  reason?: string;
  screenshotPath?: string;
};

export async function openVacancy(
  config: PlaywrightConfig,
  externalId: string,
): Promise<OpenVacancyResult> {
  const url = `${config.baseUrl}/vacancy/${externalId}`;

  try {
    return await withPage(config, async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const title =
        (await page
          .locator('[data-qa="vacancy-title"], h1')
          .first()
          .innerText()
          .catch(() => undefined)) ?? undefined;

      const company =
        (await page
          .locator('[data-qa="vacancy-company-name"], a[href*="/employer/"]')
          .first()
          .innerText()
          .catch(() => undefined)) ?? undefined;

      const descriptionSnippet =
        (await page
          .locator('[data-qa="vacancy-description"]')
          .first()
          .innerText()
          .catch(() => undefined)) ?? undefined;

      logger.info('Vacancy opened', { externalId, title });
      return {
        ok: true,
        externalId,
        url,
        title: title?.trim(),
        company: company?.trim(),
        descriptionSnippet: descriptionSnippet?.trim()?.slice(0, 2000),
      };
    });
  } catch (error) {
    logger.error('Open vacancy failed', { externalId, error });
    return {
      ok: false,
      externalId,
      url,
      reason: error instanceof Error ? error.message : 'open_failed',
    };
  }
}

/** Skeleton: open vacancy and detect apply button — does NOT click apply. */
export async function applyStub(
  config: PlaywrightConfig,
  externalId: string,
): Promise<OpenVacancyResult & { applyButtonVisible?: boolean }> {
  const opened = await openVacancy(config, externalId);
  if (!opened.ok) return opened;

  try {
    return await withPage(config, async (page) => {
      await page.goto(opened.url, { waitUntil: 'domcontentloaded' });
      const applyButton = page.getByRole('button', {
        name: /откликнуться|отклик/i,
      });
      const applyButtonVisible = await applyButton
        .first()
        .isVisible()
        .catch(() => false);

      return {
        ...opened,
        applyButtonVisible,
        reason: 'stub_no_click',
      };
    });
  } catch (error) {
    const shot = await withPage(config, async (page) => {
      await page.goto(opened.url, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
      return captureFailureArtifacts(page, config.artifactsDir, 'apply-stub');
    }).catch(() => ({ screenshotPath: undefined }));

    return {
      ...opened,
      ok: false,
      reason: error instanceof Error ? error.message : 'apply_stub_failed',
      screenshotPath: shot.screenshotPath,
    };
  }
}
