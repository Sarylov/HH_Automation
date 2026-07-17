import { access } from 'node:fs/promises';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { PlaywrightConfig } from '../config.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function storageStateExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function createBrowser(config: PlaywrightConfig): Promise<Browser> {
  return chromium.launch({ headless: config.headless });
}

export async function createContext(
  browser: Browser,
  config: PlaywrightConfig,
  options?: { withStorageState?: boolean },
): Promise<BrowserContext> {
  const useStorage =
    options?.withStorageState !== false &&
    (await storageStateExists(config.storageStatePath));

  const context = await browser.newContext({
    locale: 'ru-RU',
    viewport: { width: 1280, height: 720 },
    storageState: useStorage ? config.storageStatePath : undefined,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });

  context.setDefaultTimeout(config.defaultTimeoutMs);
  context.setDefaultNavigationTimeout(config.navigationTimeoutMs);
  return context;
}

export async function withPage<T>(
  config: PlaywrightConfig,
  fn: (page: Page, context: BrowserContext) => Promise<T>,
  options?: { withStorageState?: boolean },
): Promise<T> {
  const browser = await createBrowser(config);
  try {
    const context = await createContext(browser, config, options);
    const page = await context.newPage();
    return await fn(page, context);
  } finally {
    if (config.debugPauseMs > 0) {
      await sleep(config.debugPauseMs);
    }
    await browser.close();
  }
}
