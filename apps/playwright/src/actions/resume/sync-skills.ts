import type { Page } from 'playwright';
import type { PlaywrightConfig } from '../../config.js';
import { withPage } from '../../browser/context.js';
import { createLogger } from '../../logger.js';
import { humanDelay } from '../../utils/human-delay.js';
import { captureFailureArtifacts } from '../../utils/screenshot.js';

const logger = createLogger('resume.sync-skills');

const CHIP_QA_PREFIX = 'chips-trigger-chip-';

export type SyncResumeSkillsInput = {
  desiredSkills: string[];
};

export type SyncResumeSkillsResult = {
  ok: boolean;
  externalId: string;
  updated?: boolean;
  skipped?: boolean;
  before?: string[];
  after?: string[];
  added?: string[];
  removed?: string[];
  reason?: string;
  screenshotPath?: string;
};

function normalizeKey(skill: string): string {
  return skill.replace(/\s+/g, ' ').trim().toLowerCase();
}

function uniquePreserveOrder(skills: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of skills) {
    const name = raw.replace(/\s+/g, ' ').trim();
    if (!name) continue;
    const key = normalizeKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

function setsEqual(a: string[], b: string[]): boolean {
  const aKeys = new Set(a.map(normalizeKey));
  const bKeys = new Set(b.map(normalizeKey));
  if (aKeys.size !== bKeys.size) return false;
  for (const key of aKeys) {
    if (!bKeys.has(key)) return false;
  }
  return true;
}

function diffSkills(
  current: string[],
  desired: string[],
): { added: string[]; removed: string[] } {
  const currentKeys = new Set(current.map(normalizeKey));
  const desiredKeys = new Set(desired.map(normalizeKey));
  const removed = current.filter((s) => !desiredKeys.has(normalizeKey(s)));
  const added = desired.filter((s) => !currentKeys.has(normalizeKey(s)));
  return { added, removed };
}

async function readChipSkills(page: Page): Promise<string[]> {
  const chips = page.locator(`[data-qa^="${CHIP_QA_PREFIX}"]`);
  await chips
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 })
    .catch(() => undefined);

  const names = await chips.evaluateAll((nodes, prefix) => {
    const result: string[] = [];
    const seen = new Set<string>();
    for (const node of nodes) {
      const qa = node.getAttribute('data-qa') ?? '';
      if (!qa.startsWith(prefix)) continue;
      const fromQa = qa.slice(prefix.length).trim();
      const label =
        (
          node.querySelector('[class*="magritte-label"]')?.textContent ??
          fromQa
        )
          .replace(/\s+/g, ' ')
          .trim() || fromQa;
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(label);
    }
    return result;
  }, CHIP_QA_PREFIX);

  return names;
}

async function removeSkill(page: Page, skill: string): Promise<boolean> {
  const chip = page.locator(`[data-qa="${CHIP_QA_PREFIX}${skill}"]`).first();
  if ((await chip.count()) === 0) {
    // Fallback: match by visible label text exactly
    const byText = page
      .locator(`[data-qa^="${CHIP_QA_PREFIX}"]`)
      .filter({ hasText: new RegExp(`^\\s*${escapeRegex(skill)}\\s*$`) })
      .first();
    if ((await byText.count()) === 0) return false;
    const del = byText.locator('[data-qa="chip-delete-action"]').first();
    await del.click();
  } else {
    const del = chip.locator('[data-qa="chip-delete-action"]').first();
    await del.click();
  }

  await page
    .locator(`[data-qa="${CHIP_QA_PREFIX}${skill}"]`)
    .first()
    .waitFor({ state: 'detached', timeout: 8_000 })
    .catch(() => undefined);
  return true;
}

async function addSkill(page: Page, skill: string): Promise<void> {
  const input = page.locator('input[data-qa="chips-trigger-input"]').first();
  await input.waitFor({ state: 'visible', timeout: 10_000 });
  await input.click();
  await input.fill(skill);
  await humanDelay(120, 280);
  await input.press('Enter');
  await page
    .locator(`[data-qa="${CHIP_QA_PREFIX}${skill}"]`)
    .first()
    .waitFor({ state: 'visible', timeout: 8_000 })
    .catch(() => undefined);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isSkillsLevelsUrl(url: string): boolean {
  return url.includes('/skillsLevels');
}

function isPastKeySkills(url: string, externalId: string): boolean {
  try {
    const path = new URL(url).pathname;
    if (!path.includes(externalId)) return false;
    if (path.includes('/keySkills')) return false;
    return (
      path.includes(`/resume/${externalId}`) ||
      path.includes(`/resume/edit/${externalId}/`)
    );
  } catch {
    return false;
  }
}

function isDoneAfterLevels(url: string, externalId: string): boolean {
  try {
    const path = new URL(url).pathname;
    // Success = public resume view (not editor).
    return (
      path.includes(`/resume/${externalId}`) && !path.includes('/edit/')
    );
  } catch {
    return false;
  }
}

/**
 * On Magritte skillsLevels: click [data-qa="skill-level-3"] (Продвинутый)
 * inside each [data-qa="skill"] card — label overlay intercepts radio clicks.
 */
async function setAllSkillLevelsAdvanced(page: Page): Promise<number> {
  const skills = page.locator('[data-qa="skill"]');
  await skills.first().waitFor({ state: 'visible', timeout: 15_000 });

  const total = await skills.count();
  logger.info('Setting skill levels to advanced', { skillCards: total });

  let clicked = 0;
  for (let i = 0; i < total; i += 1) {
    const card = skills.nth(i);
    const advanced = card.locator('[data-qa="skill-level-3"]').first();
    if ((await advanced.count()) === 0) continue;

    const radio = card.locator('input[type="radio"][name$="Продвинутый"]').first();
    if (
      (await radio.count()) > 0 &&
      (await radio.isChecked().catch(() => false))
    ) {
      continue;
    }

    await humanDelay(50, 140);
    await advanced.scrollIntoViewIfNeeded().catch(() => undefined);
    // Prefer the interactive label card that wraps skill-level-3 (radio is covered).
    const levelLabel = card
      .locator('label[data-interactive="true"]')
      .filter({ has: page.locator('[data-qa="skill-level-3"]') })
      .first();
    if ((await levelLabel.count()) > 0) {
      await levelLabel.click({ timeout: 8_000 });
    } else {
      await advanced.click({ timeout: 8_000 });
    }
    clicked += 1;
  }

  return clicked;
}

async function clickSave(page: Page): Promise<void> {
  const save = page.getByRole('button', { name: /^Сохранить$/i }).first();
  await save.waitFor({ state: 'visible', timeout: 10_000 });
  await humanDelay(150, 400);
  await save.click();
}

/**
 * Browser-only: sync key-skills chips on Magritte editor.
 * Diff / ranking decisions belong in Backend.
 */
export async function syncResumeSkills(
  config: PlaywrightConfig,
  externalId: string,
  input: SyncResumeSkillsInput,
): Promise<SyncResumeSkillsResult> {
  const desired = uniquePreserveOrder(input.desiredSkills);
  const editUrl = `${config.baseUrl}/resume/edit/${externalId}/keySkills`;

  try {
    return await withPage(config, async (page) => {
      await page.goto(editUrl, { waitUntil: 'domcontentloaded' });

      if (page.url().includes('/account/login')) {
        const { screenshotPath } = await captureFailureArtifacts(
          page,
          config.artifactsDir,
          'resume-skills-sync-auth',
        );
        return {
          ok: false,
          externalId,
          reason: 'not_authenticated',
          screenshotPath,
        };
      }

      await page
        .locator('input[data-qa="chips-trigger-input"]')
        .first()
        .waitFor({ state: 'visible', timeout: 20_000 });

      const before = await readChipSkills(page);
      const { added, removed } = diffSkills(before, desired);

      if (added.length === 0 && removed.length === 0) {
        logger.info('Resume skills already up to date', { externalId });
        return {
          ok: true,
          externalId,
          updated: false,
          skipped: true,
          before,
          after: before,
          added: [],
          removed: [],
          reason: 'already_up_to_date',
        };
      }

      for (const skill of removed) {
        await humanDelay(100, 250);
        await removeSkill(page, skill);
      }

      for (const skill of added) {
        await humanDelay(120, 320);
        await addSkill(page, skill);
      }

      const afterEdits = await readChipSkills(page);
      if (!setsEqual(afterEdits, desired)) {
        const { screenshotPath } = await captureFailureArtifacts(
          page,
          config.artifactsDir,
          'resume-skills-sync-verify',
        );
        logger.warn('Pre-save skills verify failed', {
          externalId,
          desired,
          afterEdits,
        });
        return {
          ok: false,
          externalId,
          before,
          after: afterEdits,
          added,
          removed,
          reason: 'pre_save_verify_mismatch',
          screenshotPath,
        };
      }

      const overLimit = page.getByText(/Количество навыков превышено/i);
      if (await overLimit.isVisible().catch(() => false)) {
        const { screenshotPath } = await captureFailureArtifacts(
          page,
          config.artifactsDir,
          'resume-skills-sync-limit',
        );
        return {
          ok: false,
          externalId,
          before,
          after: afterEdits,
          added,
          removed,
          reason: 'skills_limit_exceeded',
          screenshotPath,
        };
      }

      await clickSave(page);

      // After keySkills save hh may land on resume view OR skillsLevels wizard step.
      await page.waitForURL(
        (url) => isPastKeySkills(url.toString(), externalId),
        { timeout: 20_000 },
      );

      if (isSkillsLevelsUrl(page.url())) {
        logger.info('Landed on skillsLevels — setting all to advanced', {
          externalId,
          url: page.url(),
        });
        const levelsSet = await setAllSkillLevelsAdvanced(page);
        await clickSave(page);
        await page.waitForURL(
          (url) => isDoneAfterLevels(url.toString(), externalId),
          { timeout: 20_000 },
        );
        logger.info('skillsLevels saved', { externalId, levelsSet });
      }

      logger.info('Resume skills synced', {
        externalId,
        added: added.length,
        removed: removed.length,
        finalUrl: page.url(),
      });

      return {
        ok: true,
        externalId,
        updated: true,
        skipped: false,
        before,
        after: afterEdits,
        added,
        removed,
      };
    });
  } catch (error) {
    logger.error('Resume skills sync failed', { externalId, error });
    const shot = await withPage(config, async (page) => {
      await page.goto(editUrl, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
      return captureFailureArtifacts(
        page,
        config.artifactsDir,
        'resume-skills-sync',
      );
    }).catch(() => ({ screenshotPath: undefined }));

    return {
      ok: false,
      externalId,
      reason: error instanceof Error ? error.message : 'skills_sync_failed',
      screenshotPath: shot.screenshotPath,
    };
  }
}
