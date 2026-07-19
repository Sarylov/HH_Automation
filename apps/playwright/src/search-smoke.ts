import './load-env.js';
import { loadConfig } from './config.js';
import { searchVacancies } from './actions/vacancies/search.js';

async function main(): Promise<void> {
  const result = await searchVacancies(loadConfig(), {
    text: process.argv[2] ?? 'frontend',
    area: process.argv[3] || undefined,
    pages: 1,
  });
  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        count: result.items.length,
        reason: result.reason,
        sample: result.items.slice(0, 3),
      },
      null,
      2,
    ),
  );
  process.exitCode = result.ok && result.items.length > 0 ? 0 : 1;
}

void main();
