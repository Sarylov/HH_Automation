import type { PlaywrightConfig } from '../../config.js';
import { withPage } from '../../browser/context.js';
import { createLogger } from '../../logger.js';
import { humanDelay } from '../../utils/human-delay.js';
import { captureFailureArtifacts } from '../../utils/screenshot.js';
import type { ResumeFields } from './read.js';

const logger = createLogger('resume.update');

export type UpdateResumeInput = {
  skills?: string[];
  about?: string;
  dryRun?: boolean;
};

export type UpdateResumeResult = {
  ok: boolean;
  externalId: string;
  updated?: boolean;
  dryRun?: boolean;
  fields?: ResumeFields;
  reason?: string;
  screenshotPath?: string;
};

/**
 * Updates resume skills and/or about via edit UI.
 * Prefer skills editor; about is best-effort if editable textarea is present.
 */
export async function updateResume(
  config: PlaywrightConfig,
  externalId: string,
  input: UpdateResumeInput,
): Promise<UpdateResumeResult> {
  const editUrl = `${config.baseUrl}/applicant/resumes/edit/skills?resume=${externalId}`;

  try {
    return await withPage(config, async (page) => {
      if (input.dryRun) {
        logger.info('Update dry-run — no writes', { externalId });
        return {
          ok: true,
          externalId,
          updated: false,
          dryRun: true,
          reason: 'dry_run',
          fields: {
            skills: input.skills ?? [],
            about: input.about,
          },
        };
      }

      await page.goto(editUrl, { waitUntil: 'domcontentloaded' });

      if (page.url().includes('/account/login')) {
        const { screenshotPath } = await captureFailureArtifacts(
          page,
          config.artifactsDir,
          'resume-update-auth',
        );
        return {
          ok: false,
          externalId,
          reason: 'not_authenticated',
          screenshotPath,
        };
      }

      let changed = false;

      if (input.skills && input.skills.length > 0) {
        const inputBox = page
          .locator(
            'input[data-qa="bloko-tag-list-input"], input[placeholder*="навык" i], input[type="text"]',
          )
          .first();

        const inputVisible = await inputBox.isVisible().catch(() => false);
        if (inputVisible) {
          for (const skill of input.skills.slice(0, 15)) {
            await humanDelay(150, 400);
            await inputBox.fill(skill);
            await inputBox.press('Enter');
            changed = true;
          }
        }
      }

      if (input.about?.trim()) {
        const aboutArea = page
          .locator(
            'textarea[data-qa*="about"], textarea[name*="skills"], textarea',
          )
          .first();
        if (await aboutArea.isVisible().catch(() => false)) {
          await aboutArea.fill(input.about.trim());
          changed = true;
        }
      }

      const save = page.getByRole('button', {
        name: /сохранить|готово|сохранить изменения/i,
      });
      if (changed && (await save.first().isVisible().catch(() => false))) {
        await humanDelay(200, 700);
        await save.first().click();
        await page
          .getByText(/сохранено|изменения сохранены/i)
          .first()
          .waitFor({ state: 'visible', timeout: 10_000 })
          .catch(() => undefined);
      }

      if (!changed) {
        return {
          ok: false,
          externalId,
          reason: 'update_controls_not_found',
        };
      }

      logger.info('Resume updated', { externalId });
      return {
        ok: true,
        externalId,
        updated: true,
        fields: {
          skills: input.skills ?? [],
          about: input.about,
        },
      };
    });
  } catch (error) {
    logger.error('Update resume failed', { externalId, error });
    const shot = await withPage(config, async (page) => {
      await page.goto(editUrl, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
      return captureFailureArtifacts(page, config.artifactsDir, 'resume-update');
    }).catch(() => ({ screenshotPath: undefined }));

    return {
      ok: false,
      externalId,
      reason: error instanceof Error ? error.message : 'update_failed',
      screenshotPath: shot.screenshotPath,
    };
  }
}
