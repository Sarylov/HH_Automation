/**
 * Interactive login helper:
 * 1. Opens a visible Chromium window on hh.ru
 * 2. You log in manually (captcha/2FA ok)
 * 3. Press Enter in this terminal
 * 4. Saves storageState for later automation
 */
import './load-env.js';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';

const logger = createLogger('auth.manual');

async function waitForEnter(message: string): Promise<void> {
  const rl = createInterface({ input, output });
  try {
    await rl.question(message);
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  process.env.PLAYWRIGHT_HEADLESS = 'false';

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    locale: 'ru-RU',
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(0);

  await page.goto(`${config.baseUrl}/account/login`, {
    waitUntil: 'domcontentloaded',
  });

  logger.info('Browser opened — log in to hh.ru in that window');
  console.log('');
  console.log('1) В открывшемся окне войди в hh.ru (капча/код — вручную).');
  console.log('2) Когда увидишь личный кабинет / резюме — вернись сюда.');
  console.log('');
  await waitForEnter('Нажми Enter, чтобы сохранить сессию... ');

  await mkdir(path.dirname(config.storageStatePath), { recursive: true });
  await context.storageState({ path: config.storageStatePath });
  logger.info('Session saved', { path: config.storageStatePath });

  await browser.close();
  console.log('Готово. Проверка:');
  console.log('  Invoke-RestMethod http://127.0.0.1:3100/auth/status');
  console.log('  Invoke-RestMethod -Method Post http://localhost:3000/api/auth/refresh');
}

main().catch((error: unknown) => {
  logger.error('Manual auth failed', { error });
  process.exitCode = 1;
});
