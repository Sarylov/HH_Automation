import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from 'playwright';

export async function captureFailureArtifacts(
  page: Page,
  artifactsDir: string,
  label: string,
): Promise<{ screenshotPath: string }> {
  await mkdir(artifactsDir, { recursive: true });
  const safe = label.replace(/[^a-zA-Z0-9_-]+/g, '_');
  const screenshotPath = path.join(
    artifactsDir,
    `${safe}-${Date.now()}.png`,
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return { screenshotPath };
}
