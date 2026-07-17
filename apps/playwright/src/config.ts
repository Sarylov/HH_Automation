export type PlaywrightConfig = {
  baseUrl: string;
  headless: boolean;
  defaultTimeoutMs: number;
  navigationTimeoutMs: number;
  servicePort: number;
  storageStatePath: string;
  artifactsDir: string;
  debugPauseMs: number;
};

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw === '1' || raw.toLowerCase() === 'true';
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Env ${name} must be an integer`);
  }
  return parsed;
}

export function loadConfig(): PlaywrightConfig {
  return {
    baseUrl: env('HH_BASE_URL', 'https://hh.ru'),
    headless: envBool('PLAYWRIGHT_HEADLESS', true),
    defaultTimeoutMs: envInt('PLAYWRIGHT_DEFAULT_TIMEOUT_MS', 30_000),
    navigationTimeoutMs: envInt('PLAYWRIGHT_NAVIGATION_TIMEOUT_MS', 60_000),
    servicePort: envInt('PLAYWRIGHT_PORT', 3100),
    storageStatePath: env(
      'PLAYWRIGHT_STORAGE_STATE_PATH',
      './.auth/storage-state.json',
    ),
    artifactsDir: env('PLAYWRIGHT_ARTIFACTS_DIR', './artifacts'),
    debugPauseMs: envInt('PLAYWRIGHT_DEBUG_PAUSE_MS', 0),
  };
}
