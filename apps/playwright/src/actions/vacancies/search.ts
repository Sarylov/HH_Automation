import type { Page } from 'playwright';
import type { PlaywrightConfig } from '../../config.js';
import { withPage } from '../../browser/context.js';
import { createLogger } from '../../logger.js';
import { captureFailureArtifacts } from '../../utils/screenshot.js';

const logger = createLogger('vacancies.search');

export type RawVacancy = {
  externalId: string;
  title: string;
  url: string;
  company?: string;
  salary?: string;
  snippet?: string;
};

export type SearchVacanciesResult = {
  ok: boolean;
  query: {
    text: string;
    area?: string;
    pages: number;
    excludedText?: string;
    workFormat?: 'REMOTE';
    searchPeriod?: number;
    searchField?: 'name' | 'company_name' | 'description';
  };
  items: RawVacancy[];
  reason?: string;
  screenshotPath?: string;
};

async function parseSerpPage(page: Page): Promise<RawVacancy[]> {
  return page.evaluate(() => {
    const seen = new Set<string>();
    const items: Array<{
      externalId: string;
      title: string;
      url: string;
      company?: string;
      salary?: string;
      snippet?: string;
    }> = [];

    const anchors = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('a[href*="/vacancy/"]'),
    );

    for (const anchor of anchors) {
      const href = anchor.getAttribute('href') ?? '';
      const match = href.match(/\/vacancy\/(\d+)/);
      const externalId = match?.[1];
      if (!externalId || seen.has(externalId)) continue;
      seen.add(externalId);

      const card =
        anchor.closest('[data-qa="vacancy-serp__vacancy"]') ??
        anchor.closest('[data-qa="serp-item"]') ??
        anchor.closest('div');

      const title = (anchor.textContent ?? '').trim() || `Vacancy ${externalId}`;
      const company = card
        ?.querySelector(
          '[data-qa="vacancy-serp__vacancy-employer"], [data-qa="vacancy-serp__vacancy-employer-name"], a[href*="/employer/"]',
        )
        ?.textContent?.trim();
      const salary = card
        ?.querySelector(
          '[data-qa="vacancy-serp__vacancy-compensation"], [data-qa="vacancy-salary"]',
        )
        ?.textContent?.trim();
      const snippet = card
        ?.querySelector(
          '[data-qa="vacancy-serp__vacancy_snippet"], [data-qa="vacancy-serp__vacancy_snippet_requirement"]',
        )
        ?.textContent?.trim();

      const url = href.startsWith('http')
        ? href.split('?')[0]
        : `https://hh.ru/vacancy/${externalId}`;

      items.push({
        externalId,
        title,
        url,
        company: company || undefined,
        salary: salary || undefined,
        snippet: snippet || undefined,
      });
    }

    return items;
  });
}

/** Prefer 100/page in UI if hh ignores items_on_page; then scroll lazy SERP. */
async function expandSerpResults(page: Page): Promise<void> {
  const sizeControls = page.locator(
    'a[data-qa="pager-page-size"], button[data-qa="pager-page-size"], [data-qa*="page-size"] a, [data-qa*="page-size"] button',
  );
  const hundred = sizeControls.filter({ hasText: /^\s*100\s*$/ }).first();
  if ((await hundred.count()) > 0 && (await hundred.isVisible().catch(() => false))) {
    await hundred.click();
    await page
      .locator('[data-qa="vacancy-serp__vacancy"], [data-qa="serp-item"], a[href*="/vacancy/"]')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => undefined);
  }

  let stable = 0;
  let prev = 0;
  for (let i = 0; i < 25; i += 1) {
    const count = await page.locator('a[href*="/vacancy/"]').count();
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await page
      .waitForFunction(
        `document.querySelectorAll('a[href*="/vacancy/"]').length > ${count}`,
        undefined,
        { timeout: 800 },
      )
      .catch(() => undefined);
    if (count <= prev) {
      stable += 1;
      if (stable >= 3) break;
    } else {
      stable = 0;
    }
    prev = count;
  }
  await page.evaluate('window.scrollTo(0, 0)');
}

function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label}_timeout_${ms}ms`));
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function searchVacancies(
  config: PlaywrightConfig,
  input: {
    text: string;
    area?: string;
    pages?: number;
    excludedText?: string;
    workFormat?: 'REMOTE';
    searchPeriod?: number;
    searchField?: 'name' | 'company_name' | 'description';
  },
): Promise<SearchVacanciesResult> {
  const pages = Math.min(Math.max(input.pages ?? 1, 1), 3);
  const area = input.area?.trim() || undefined;
  const excludedText =
    input.excludedText?.trim() ||
    process.env.HH_EXCLUDED_TEXT?.trim() ||
    undefined;
  const workFormat =
    input.workFormat ??
    ((process.env.HH_WORK_FORMAT ?? '').toUpperCase() === 'REMOTE'
      ? 'REMOTE'
      : undefined);
  const searchPeriod = input.searchPeriod ?? Number(process.env.HH_SEARCH_PERIOD ?? '3');
  const searchField =
    input.searchField ??
    ((process.env.HH_SEARCH_FIELD as 'name' | 'company_name' | 'description' | undefined) ??
      'name');
  const query = {
    text: input.text,
    area,
    pages,
    excludedText,
    workFormat,
    searchPeriod,
    searchField,
  };
  const deadlineMs = config.navigationTimeoutMs + 30_000;

  try {
    const result = await withDeadline(
      withPage(config, async (page) => {
        const collected: RawVacancy[] = [];
        const seen = new Set<string>();

        for (let pageIndex = 0; pageIndex < pages; pageIndex += 1) {
          const searchUrl = new URL(`${config.baseUrl}/search/vacancy`);
          searchUrl.searchParams.set('text', input.text);
          if (area) {
            searchUrl.searchParams.set('area', area);
          }
          searchUrl.searchParams.set('page', String(pageIndex));
          searchUrl.searchParams.set('search_field', searchField);
          searchUrl.searchParams.set('search_period', String(searchPeriod));
          searchUrl.searchParams.set('items_on_page', '100');
          if (excludedText) {
            searchUrl.searchParams.set('excluded_text', excludedText);
          }
          if (workFormat) {
            searchUrl.searchParams.set('work_format', workFormat);
          }

          const targetUrl = searchUrl.toString();
          logger.info('Opening vacancy search', {
            targetUrl,
            area: area ?? null,
          });

          await page.goto(targetUrl, {
            waitUntil: 'domcontentloaded',
            timeout: config.navigationTimeoutMs,
          });

          // hh often injects area from cookies/geo when omitted — strip it once
          if (!area) {
            const landed = new URL(page.url());
            if (landed.searchParams.has('area')) {
              landed.searchParams.delete('area');
              landed.searchParams.set('items_on_page', '100');
              logger.info('Stripped injected area from search URL', {
                finalUrl: landed.toString(),
              });
              await page.goto(landed.toString(), {
                waitUntil: 'domcontentloaded',
                timeout: config.navigationTimeoutMs,
              });
            }
          }

          await expandSerpResults(page);

          const batch = await parseSerpPage(page);
          logger.info('SERP page parsed', {
            pageIndex,
            batchCount: batch.length,
            finalUrl: page.url(),
          });
          for (const item of batch) {
            if (seen.has(item.externalId)) continue;
            seen.add(item.externalId);
            collected.push(item);
          }
        }

        logger.info('Vacancy search done', { count: collected.length, ...query });
        return { ok: true, query, items: collected };
      }),
      deadlineMs,
      'vacancy_search',
    );

    return result;
  } catch (error) {
    logger.error('Vacancy search failed', { error });
    let screenshotPath: string | undefined;
    try {
      await withPage(config, async (page) => {
        await page
          .goto(`${config.baseUrl}/search/vacancy?text=${encodeURIComponent(input.text)}`, {
            waitUntil: 'domcontentloaded',
            timeout: 15_000,
          })
          .catch(() => undefined);
        const shot = await captureFailureArtifacts(
          page,
          config.artifactsDir,
          'vacancy-search-failed',
        );
        screenshotPath = shot.screenshotPath;
      });
    } catch {
      // ignore secondary failure
    }

    return {
      ok: false,
      query,
      items: [],
      reason: error instanceof Error ? error.message : 'search_failed',
      screenshotPath,
    };
  }
}
