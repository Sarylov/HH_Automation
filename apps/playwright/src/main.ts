import './load-env.js';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { checkAuthSession } from './actions/auth/check-session.js';
import { loginSkeleton } from './actions/auth/login.js';
import { searchVacancies } from './actions/vacancies/search.js';
import { applyToVacancy } from './actions/vacancies/apply.js';
import { applyStub, openVacancy } from './actions/vacancies/open.js';
import { listResumes } from './actions/resume/list.js';
import { raiseResume } from './actions/resume/raise.js';
import { readResume } from './actions/resume/read.js';
import { updateResume } from './actions/resume/update.js';
import { listChats } from './actions/chat/list.js';
import { readChat } from './actions/chat/read.js';
import { sendChatMessage } from './actions/chat/send.js';

const logger = createLogger('playwright-http');

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw) as unknown;
}

async function main(): Promise<void> {
  const config = loadConfig();

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${config.servicePort}`);
      const method = req.method ?? 'GET';

      try {
        if (method === 'GET' && url.pathname === '/health') {
          sendJson(res, 200, { status: 'up', service: 'playwright' });
          return;
        }

        if (method === 'GET' && url.pathname === '/auth/status') {
          sendJson(res, 200, await checkAuthSession(config));
          return;
        }

        if (method === 'POST' && url.pathname === '/auth/login') {
          const body = (await readJsonBody(req)) as {
            login?: string;
            password?: string;
          };
          const result = await loginSkeleton(config, {
            login: body.login ?? process.env.HH_LOGIN,
            password: body.password ?? process.env.HH_PASSWORD,
          });
          sendJson(res, result.ok ? 200 : 501, result);
          return;
        }

        if (method === 'POST' && url.pathname === '/vacancies/search') {
          const body = (await readJsonBody(req)) as {
            text?: string;
            area?: string;
            pages?: number;
            excludedText?: string;
            workFormat?: 'REMOTE';
            searchPeriod?: number;
            searchField?: 'name' | 'company_name' | 'description';
          };
          const text =
            body.text?.trim() ||
            process.env.HH_SEARCH_TEXT?.trim() ||
            '';
          if (!text) {
            sendJson(res, 400, { ok: false, reason: 'text_required' });
            return;
          }
          const result = await searchVacancies(config, {
            text,
            area: body.area,
            pages: body.pages,
            excludedText: body.excludedText,
            workFormat: body.workFormat,
            searchPeriod: body.searchPeriod,
            searchField: body.searchField,
          });
          sendJson(res, result.ok ? 200 : 502, result);
          return;
        }

        const vacancyMatch = url.pathname.match(
          /^\/vacancies\/(\d+)(?:\/(apply-stub|apply))?$/,
        );
        if (vacancyMatch) {
          const externalId = vacancyMatch[1];
          const action = vacancyMatch[2];
          if (method === 'GET' && !action) {
            sendJson(res, 200, await openVacancy(config, externalId));
            return;
          }
          if (method === 'POST' && action === 'apply-stub') {
            sendJson(res, 200, await applyStub(config, externalId));
            return;
          }
          if (method === 'POST' && action === 'apply') {
            const body = (await readJsonBody(req)) as {
              coverLetter?: string;
              dryRun?: boolean;
            };
            const result = await applyToVacancy(config, externalId, {
              coverLetter: body.coverLetter,
              dryRun: body.dryRun,
            });
            sendJson(res, result.ok ? 200 : 502, result);
            return;
          }
        }

        if (method === 'GET' && url.pathname === '/resumes') {
          const result = await listResumes(config);
          sendJson(res, result.ok ? 200 : 502, result);
          return;
        }

        const resumeMatch = url.pathname.match(
          /^\/resumes\/([a-f0-9]+)(?:\/(raise|update))?$/i,
        );
        if (resumeMatch) {
          const externalId = resumeMatch[1];
          const action = resumeMatch[2];
          if (method === 'GET' && !action) {
            sendJson(res, 200, await readResume(config, externalId));
            return;
          }
          if (method === 'POST' && action === 'raise') {
            const body = (await readJsonBody(req)) as { dryRun?: boolean };
            const result = await raiseResume(config, externalId, {
              dryRun: body.dryRun,
            });
            sendJson(res, result.ok ? 200 : 502, result);
            return;
          }
          if (method === 'POST' && action === 'update') {
            const body = (await readJsonBody(req)) as {
              skills?: string[];
              about?: string;
              dryRun?: boolean;
            };
            const result = await updateResume(config, externalId, {
              skills: body.skills,
              about: body.about,
              dryRun: body.dryRun,
            });
            sendJson(res, result.ok ? 200 : 502, result);
            return;
          }
        }

        if (method === 'GET' && url.pathname === '/chats') {
          const result = await listChats(config);
          sendJson(res, result.ok ? 200 : 502, result);
          return;
        }

        const chatMatch = url.pathname.match(
          /^\/chats\/([^/]+)(?:\/(send))?$/i,
        );
        if (chatMatch) {
          const externalId = decodeURIComponent(chatMatch[1]);
          const action = chatMatch[2];
          if (method === 'GET' && !action) {
            sendJson(res, 200, await readChat(config, externalId));
            return;
          }
          if (method === 'POST' && action === 'send') {
            const body = (await readJsonBody(req)) as {
              text?: string;
              dryRun?: boolean;
            };
            if (!body.text?.trim()) {
              sendJson(res, 400, { ok: false, reason: 'text_required' });
              return;
            }
            const result = await sendChatMessage(config, externalId, {
              text: body.text,
              dryRun: body.dryRun,
            });
            sendJson(res, result.ok ? 200 : 502, result);
            return;
          }
        }

        sendJson(res, 404, { error: 'not_found' });
      } catch (error) {
        logger.error('Request failed', { path: url.pathname, error });
        sendJson(res, 500, {
          error: 'internal_error',
          message: error instanceof Error ? error.message : 'unknown',
        });
      }
    })();
  });

  server.listen(config.servicePort, '0.0.0.0', () => {
    logger.info('Playwright service listening', {
      port: config.servicePort,
      headless: config.headless,
      debugPauseMs: config.debugPauseMs,
    });
  });
}

main().catch((error: unknown) => {
  logger.error('Fatal error', { error });
  process.exitCode = 1;
});
