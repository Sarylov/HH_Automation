import type { PlaywrightConfig } from '../../config.js';
import { withPage } from '../../browser/context.js';
import { createLogger } from '../../logger.js';
import { captureFailureArtifacts } from '../../utils/screenshot.js';

const logger = createLogger('resume.read');

export type ResumeFields = {
  title?: string;
  about?: string;
  skills: string[];
  salary?: string;
};

export type ReadResumeResult = {
  ok: boolean;
  externalId: string;
  url: string;
  fields?: ResumeFields;
  reason?: string;
  screenshotPath?: string;
};

function uniqueSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of skills) {
    const skill = raw.trim();
    if (!skill) continue;
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(skill);
  }
  return result;
}

/**
 * Reads editable-ish resume fields from the public/applicant resume view.
 */
export async function readResume(
  config: PlaywrightConfig,
  externalId: string,
): Promise<ReadResumeResult> {
  const url = `${config.baseUrl}/resume/${externalId}`;

  try {
    return await withPage(config, async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      if (page.url().includes('/account/login')) {
        const { screenshotPath } = await captureFailureArtifacts(
          page,
          config.artifactsDir,
          'resume-read-auth',
        );
        return {
          ok: false,
          externalId,
          url,
          reason: 'not_authenticated',
          screenshotPath,
        };
      }

      const title =
        (
          await page
            .locator('[data-qa="resume-title"], h1')
            .first()
            .innerText()
            .catch(() => undefined)
        )?.trim() ?? undefined;

      const salary =
        (
          await page
            .locator('[data-qa="resume-salary"], [data-qa="resume-block-salary"]')
            .first()
            .innerText()
            .catch(() => undefined)
        )?.trim() ?? undefined;

      const about =
        (
          await page
            .locator(
              '[data-qa="resume-block-skills-text"], [data-qa="resume-about"], section:has-text("О себе")',
            )
            .first()
            .innerText()
            .catch(() => undefined)
        )?.trim()
          ?.slice(0, 4000) ?? undefined;

      const skillLocators = page.locator(
        '[data-qa="bloko-tag__text"], [data-qa="skills-element"], [class*="bloko-tag"]',
      );
      const skillCount = await skillLocators.count();
      const skillsRaw: string[] = [];
      for (let i = 0; i < Math.min(skillCount, 80); i += 1) {
        const text = await skillLocators.nth(i).innerText().catch(() => '');
        if (text.trim()) skillsRaw.push(text.trim());
      }

      const fields: ResumeFields = {
        title,
        about,
        skills: uniqueSkills(skillsRaw),
        salary,
      };

      logger.info('Resume read', {
        externalId,
        skills: fields.skills.length,
      });

      return { ok: true, externalId, url, fields };
    });
  } catch (error) {
    logger.error('Read resume failed', { externalId, error });
    return {
      ok: false,
      externalId,
      url,
      reason: error instanceof Error ? error.message : 'read_failed',
    };
  }
}
