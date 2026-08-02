import type { Page } from 'playwright';
import type { PlaywrightConfig } from '../../config.js';
import { withPage } from '../../browser/context.js';
import { createLogger } from '../../logger.js';
import { captureFailureArtifacts } from '../../utils/screenshot.js';

const logger = createLogger('skills.collect');

export type SkillsCollectProfileInput = {
  label: string;
  text: string;
  area?: string;
  excludedText?: string;
  workFormat?: 'REMOTE';
  searchPeriod?: number;
  searchField?: 'name' | 'company_name' | 'description';
  itemsOnPage?: number;
  delayMs?: number;
};

export type SkillsCollectVacancyItem = {
  externalId: string;
  url: string;
  skills: string[];
};

export type SkillsCollectProfileResult = {
  ok: boolean;
  label: string;
  query: {
    text: string;
    area?: string;
    excludedText?: string;
    workFormat?: 'REMOTE';
    searchPeriod: number;
    searchField: 'name' | 'company_name' | 'description';
    itemsOnPage: number;
  };
  expectedTotal: number;
  collected: number;
  items: SkillsCollectVacancyItem[];
  vacanciesWithoutSkills: string[];
  reason?: string;
  screenshotPath?: string;
};

type SerpVacancy = {
  externalId: string;
  url: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseExpectedTotal(page: Page): Promise<number> {
  const fromQa = await page
    .locator(
      '[data-qa="vacancies-total-found"], [data-qa="vacancies-search-header"], h1',
    )
    .first()
    .innerText()
    .catch(() => '');

  const fromBody = await page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll('h1, [data-qa*="vacancies"], [data-qa*="search-header"]'),
    );
    return nodes.map((n) => n.textContent ?? '').join(' ');
  });

  const blob = `${fromQa} ${fromBody}`;
  const match = blob.match(/([\d\s\u00a0]+)\s*вакан/i);
  if (!match) {
    const bodyMatch = await page.evaluate(() => {
      const text = document.body?.innerText ?? '';
      const m = text.match(/Найдено\s+([\d\s\u00a0]+)\s+вакан/i);
      return m?.[1] ?? null;
    });
    if (!bodyMatch) return 0;
    return Number.parseInt(bodyMatch.replace(/[\s\u00a0]/g, ''), 10) || 0;
  }
  return Number.parseInt(match[1].replace(/[\s\u00a0]/g, ''), 10) || 0;
}

async function parseSerpVacancyIds(page: Page): Promise<SerpVacancy[]> {
  return page.evaluate(() => {
    const seen = new Set<string>();
    const items: Array<{ externalId: string; url: string }> = [];
    const anchors = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('a[href*="/vacancy/"]'),
    );
    for (const anchor of anchors) {
      const href = anchor.getAttribute('href') ?? '';
      const match = href.match(/\/vacancy\/(\d+)/);
      const externalId = match?.[1];
      if (!externalId || seen.has(externalId)) continue;
      seen.add(externalId);
      const url = href.startsWith('http')
        ? href.split('?')[0]
        : `https://hh.ru/vacancy/${externalId}`;
      items.push({ externalId, url });
    }
    return items;
  });
}

async function expandSerpResults(page: Page): Promise<void> {
  let stable = 0;
  let prev = 0;
  for (let i = 0; i < 20; i += 1) {
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

async function readVacancySkills(page: Page, url: string): Promise<string[]> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  const skillsRoot = page.locator(
    '[data-qa="skills-element"], [data-qa="bloko-tag__text"], section:has-text("Ключевые навыки") [class*="tag"]',
  );
  await skillsRoot
    .first()
    .waitFor({ state: 'visible', timeout: 8_000 })
    .catch(() => undefined);

  // Keep evaluate body free of nested function decls — tsx can inject `__name`
  // helpers that break browser-side evaluation.
  const skills = await page.evaluate(() => {
    const collected: string[] = [];
    const seen = new Set<string>();

    const qaNodes = Array.from(
      document.querySelectorAll(
        '[data-qa="skills-element"], [data-qa="bloko-tag__text"]',
      ),
    );
    for (const node of qaNodes) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      collected.push(text);
    }

    if (collected.length > 0) return collected;

    const headings = Array.from(document.querySelectorAll('h2, h3, div, span'));
    for (const heading of headings) {
      const title = (heading.textContent ?? '').trim().toLowerCase();
      if (title !== 'ключевые навыки') continue;
      const section =
        heading.closest('section, div') ?? heading.parentElement ?? heading;
      const tags = Array.from(
        section.querySelectorAll(
          '[class*="tag"], [data-qa*="skill"], span, a',
        ),
      );
      for (const tag of tags) {
        const t = (tag.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (!t || t.toLowerCase() === 'ключевые навыки' || t.length >= 80) {
          continue;
        }
        const key = t.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push(t);
      }
      break;
    }

    return collected;
  });

  return skills;
}

function buildSearchUrl(
  baseUrl: string,
  input: SkillsCollectProfileInput,
  pageIndex: number,
  itemsOnPage: number,
  searchPeriod: number,
  searchField: string,
): URL {
  const searchUrl = new URL(`${baseUrl}/search/vacancy`);
  searchUrl.searchParams.set('text', input.text);
  if (input.area?.trim()) {
    searchUrl.searchParams.set('area', input.area.trim());
  }
  searchUrl.searchParams.set('page', String(pageIndex));
  searchUrl.searchParams.set('search_field', searchField);
  searchUrl.searchParams.set('search_period', String(searchPeriod));
  searchUrl.searchParams.set('items_on_page', String(itemsOnPage));
  searchUrl.searchParams.set('enable_snippets', 'true');
  searchUrl.searchParams.set('ored_clusters', 'true');
  if (input.excludedText?.trim()) {
    searchUrl.searchParams.set('excluded_text', input.excludedText.trim());
  }
  if (input.workFormat) {
    searchUrl.searchParams.set('work_format', input.workFormat);
  }
  return searchUrl;
}

/**
 * Browser-only: full SERP for one profile + key skills from each vacancy.
 * Aggregation / ranking belongs in Backend.
 */
export async function collectProfileSkills(
  config: PlaywrightConfig,
  input: SkillsCollectProfileInput,
): Promise<SkillsCollectProfileResult> {
  const label = input.label.trim().toLowerCase();
  const itemsOnPage = Math.min(Math.max(input.itemsOnPage ?? 100, 1), 100);
  const searchPeriod = input.searchPeriod ?? 3;
  const searchField = input.searchField ?? 'name';
  const delayMs = Math.max(input.delayMs ?? 1_500, 0);
  const area = input.area?.trim() || undefined;
  const excludedText = input.excludedText?.trim() || undefined;
  const query = {
    text: input.text,
    area,
    excludedText,
    workFormat: input.workFormat,
    searchPeriod,
    searchField,
    itemsOnPage,
  };

  try {
    return await withPage(config, async (page) => {
      const serp: SerpVacancy[] = [];
      const seen = new Set<string>();
      let expectedTotal = 0;
      let pageIndex = 0;
      let emptyPages = 0;

      while (true) {
        const searchUrl = buildSearchUrl(
          config.baseUrl,
          { ...input, area, excludedText },
          pageIndex,
          itemsOnPage,
          searchPeriod,
          searchField,
        );
        const targetUrl = searchUrl.toString();
        logger.info('Opening skills SERP page', {
          label,
          pageIndex,
          targetUrl,
        });

        await page.goto(targetUrl, {
          waitUntil: 'domcontentloaded',
          timeout: config.navigationTimeoutMs,
        });

        if (!area) {
          const landed = new URL(page.url());
          if (landed.searchParams.has('area')) {
            landed.searchParams.delete('area');
            landed.searchParams.set('items_on_page', String(itemsOnPage));
            logger.info('Stripped injected area from skills SERP', {
              finalUrl: landed.toString(),
            });
            await page.goto(landed.toString(), {
              waitUntil: 'domcontentloaded',
              timeout: config.navigationTimeoutMs,
            });
          }
        }

        await expandSerpResults(page);

        if (pageIndex === 0) {
          expectedTotal = await parseExpectedTotal(page);
          logger.info('Skills SERP expected total', { label, expectedTotal });
          if (expectedTotal <= 0) {
            const { screenshotPath } = await captureFailureArtifacts(
              page,
              config.artifactsDir,
              'skills-serp-total-missing',
            );
            return {
              ok: false,
              label,
              query,
              expectedTotal: 0,
              collected: 0,
              items: [],
              vacanciesWithoutSkills: [],
              reason: 'expected_total_not_found',
              screenshotPath,
            };
          }
        }

        const batch = await parseSerpVacancyIds(page);
        let added = 0;
        for (const item of batch) {
          if (seen.has(item.externalId)) continue;
          seen.add(item.externalId);
          serp.push(item);
          added += 1;
        }

        logger.info('Skills SERP page parsed', {
          label,
          pageIndex,
          added,
          collected: serp.length,
          expectedTotal,
        });

        if (added === 0) {
          emptyPages += 1;
        } else {
          emptyPages = 0;
        }

        if (serp.length >= expectedTotal || emptyPages >= 2) {
          break;
        }

        pageIndex += 1;
        if (delayMs > 0) await sleep(delayMs);
      }

      if (serp.length < expectedTotal) {
        const { screenshotPath } = await captureFailureArtifacts(
          page,
          config.artifactsDir,
          'skills-serp-incomplete',
        );
        return {
          ok: false,
          label,
          query,
          expectedTotal,
          collected: serp.length,
          items: [],
          vacanciesWithoutSkills: [],
          reason: `incomplete_serp collected=${serp.length} expected=${expectedTotal}`,
          screenshotPath,
        };
      }

      const items: SkillsCollectVacancyItem[] = [];
      const vacanciesWithoutSkills: string[] = [];

      for (let i = 0; i < serp.length; i += 1) {
        const vacancy = serp[i];
        if (delayMs > 0 && i > 0) await sleep(delayMs);

        const skills = await readVacancySkills(page, vacancy.url);
        if (skills.length === 0) {
          logger.info('Vacancy without key skills', {
            label,
            url: vacancy.url,
          });
          vacanciesWithoutSkills.push(vacancy.url);
          items.push({
            externalId: vacancy.externalId,
            url: vacancy.url,
            skills: [],
          });
          continue;
        }

        items.push({
          externalId: vacancy.externalId,
          url: vacancy.url,
          skills,
        });

        if ((i + 1) % 10 === 0 || i + 1 === serp.length) {
          logger.info('Skills collect progress', {
            label,
            done: i + 1,
            total: serp.length,
          });
        }
      }

      return {
        ok: true,
        label,
        query,
        expectedTotal,
        collected: serp.length,
        items,
        vacanciesWithoutSkills,
      };
    });
  } catch (error) {
    logger.error('Skills profile collect failed', { label, error });
    return {
      ok: false,
      label,
      query,
      expectedTotal: 0,
      collected: 0,
      items: [],
      vacanciesWithoutSkills: [],
      reason: error instanceof Error ? error.message : 'skills_collect_failed',
    };
  }
}
