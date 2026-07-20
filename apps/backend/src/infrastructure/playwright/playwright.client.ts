import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type PlaywrightAuthProbe = {
  reachable: boolean;
  status: 'up' | 'down' | 'unknown';
  storageStatePresent?: boolean;
  checkedAt?: string;
  url?: string;
  reason?: string;
  screenshotPath?: string;
};

export type PlaywrightVacancyItem = {
  externalId: string;
  title: string;
  url: string;
  company?: string;
  salary?: string;
  snippet?: string;
};

export type PlaywrightSearchResult = {
  ok: boolean;
  query: {
    text: string;
    area?: string;
    pages: number;
    excludedText?: string;
    workFormat?: 'REMOTE';
    searchPeriod?: number;
    searchField?: 'name' | 'company_name' | 'description';
  };
  items: PlaywrightVacancyItem[];
  reason?: string;
};

export type PlaywrightOpenVacancyResult = {
  ok: boolean;
  externalId: string;
  url: string;
  title?: string;
  company?: string;
  descriptionSnippet?: string;
  reason?: string;
  screenshotPath?: string;
};

export type PlaywrightApplyStubResult = {
  ok: boolean;
  externalId: string;
  url: string;
  title?: string;
  applyButtonVisible?: boolean;
  reason?: string;
};

export type PlaywrightApplyVacancyResult = {
  ok: boolean;
  externalId: string;
  url: string;
  applied?: boolean;
  coverLetterAttached?: boolean;
  needsManual?: boolean;
  dryRun?: boolean;
  alreadyApplied?: boolean;
  reason?: string;
  screenshotPath?: string;
};

export type PlaywrightResumeListItem = {
  externalId: string;
  title?: string;
  url: string;
};

export type PlaywrightListResumesResult = {
  ok: boolean;
  items: PlaywrightResumeListItem[];
  reason?: string;
  screenshotPath?: string;
};

export type PlaywrightResumeFields = {
  title?: string;
  about?: string;
  skills: string[];
  salary?: string;
};

export type PlaywrightReadResumeResult = {
  ok: boolean;
  externalId: string;
  url: string;
  fields?: PlaywrightResumeFields;
  reason?: string;
  screenshotPath?: string;
};

export type PlaywrightRaiseResumeResult = {
  ok: boolean;
  externalId: string;
  raised?: boolean;
  skipped?: boolean;
  dryRun?: boolean;
  reason?: string;
  screenshotPath?: string;
};

export type PlaywrightUpdateResumeResult = {
  ok: boolean;
  externalId: string;
  updated?: boolean;
  dryRun?: boolean;
  fields?: PlaywrightResumeFields;
  reason?: string;
  screenshotPath?: string;
};

export type PlaywrightChatListItem = {
  externalId: string;
  url: string;
  employerName?: string;
  vacancyTitle?: string;
  preview?: string;
  unread?: boolean;
};

export type PlaywrightListChatsResult = {
  ok: boolean;
  items: PlaywrightChatListItem[];
  reason?: string;
  screenshotPath?: string;
};

export type PlaywrightChatMessageItem = {
  externalId?: string;
  role: 'employer' | 'applicant' | 'system';
  body: string;
  sentAt?: string;
};

export type PlaywrightReadChatResult = {
  ok: boolean;
  externalId: string;
  url: string;
  employerName?: string;
  vacancyTitle?: string;
  messages: PlaywrightChatMessageItem[];
  reason?: string;
  screenshotPath?: string;
};

export type PlaywrightSendChatResult = {
  ok: boolean;
  externalId: string;
  url: string;
  sent?: boolean;
  dryRun?: boolean;
  reason?: string;
  screenshotPath?: string;
};

@Injectable()
export class PlaywrightClient {
  private readonly logger = new Logger(PlaywrightClient.name);

  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    return this.config.get<string>(
      'PLAYWRIGHT_BASE_URL',
      'http://127.0.0.1:3100',
    );
  }

  async health(): Promise<'up' | 'down'> {
    try {
      const res = await fetch(`${this.baseUrl()}/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok ? 'up' : 'down';
    } catch (error) {
      this.logger.warn({ msg: 'Playwright health failed', error: String(error) });
      return 'down';
    }
  }

  async getAuthStatus(): Promise<PlaywrightAuthProbe> {
    try {
      const res = await fetch(`${this.baseUrl()}/auth/status`, {
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        return {
          reachable: true,
          status: 'down',
          reason: `http_${res.status}`,
          checkedAt: new Date().toISOString(),
        };
      }
      const body = (await res.json()) as Omit<PlaywrightAuthProbe, 'reachable'>;
      return { reachable: true, ...body };
    } catch (error) {
      this.logger.warn({
        msg: 'Playwright auth status failed',
        error: String(error),
      });
      return {
        reachable: false,
        status: 'unknown',
        reason: 'playwright_unreachable',
        checkedAt: new Date().toISOString(),
      };
    }
  }

  async searchVacancies(input: {
    text: string;
    area?: string;
    pages?: number;
    excludedText?: string;
    workFormat?: 'REMOTE';
    searchPeriod?: number;
    searchField?: 'name' | 'company_name' | 'description';
  }): Promise<PlaywrightSearchResult> {
    try {
      const res = await fetch(`${this.baseUrl()}/vacancies/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(180_000),
      });
      const body = (await res.json()) as PlaywrightSearchResult;
      if (!res.ok) {
        this.logger.warn({ msg: 'Vacancy search HTTP error', status: res.status });
      }
      return body;
    } catch (error) {
      this.logger.warn({
        msg: 'Vacancy search failed',
        error: String(error),
      });
      return {
        ok: false,
        query: {
          text: input.text,
          area: input.area,
          pages: input.pages ?? 1,
          excludedText: input.excludedText,
          workFormat: input.workFormat,
          searchPeriod: input.searchPeriod,
          searchField: input.searchField,
        },
        items: [],
        reason:
          error instanceof Error ? error.message : 'playwright_search_unreachable',
      };
    }
  }

  async openVacancy(externalId: string): Promise<PlaywrightOpenVacancyResult> {
    const res = await fetch(`${this.baseUrl()}/vacancies/${externalId}`, {
      signal: AbortSignal.timeout(90_000),
    });
    return (await res.json()) as PlaywrightOpenVacancyResult;
  }

  async applyStub(externalId: string): Promise<PlaywrightApplyStubResult> {
    const res = await fetch(
      `${this.baseUrl()}/vacancies/${externalId}/apply-stub`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(90_000),
      },
    );
    return (await res.json()) as PlaywrightApplyStubResult;
  }

  async applyVacancy(input: {
    externalId: string;
    coverLetter?: string;
    dryRun?: boolean;
  }): Promise<PlaywrightApplyVacancyResult> {
    const res = await fetch(
      `${this.baseUrl()}/vacancies/${input.externalId}/apply`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coverLetter: input.coverLetter,
          dryRun: input.dryRun,
        }),
        signal: AbortSignal.timeout(120_000),
      },
    );
    return (await res.json()) as PlaywrightApplyVacancyResult;
  }

  async listResumes(): Promise<PlaywrightListResumesResult> {
    const res = await fetch(`${this.baseUrl()}/resumes`, {
      signal: AbortSignal.timeout(90_000),
    });
    return (await res.json()) as PlaywrightListResumesResult;
  }

  async readResume(externalId: string): Promise<PlaywrightReadResumeResult> {
    const res = await fetch(`${this.baseUrl()}/resumes/${externalId}`, {
      signal: AbortSignal.timeout(90_000),
    });
    return (await res.json()) as PlaywrightReadResumeResult;
  }

  async raiseResume(input: {
    externalId: string;
    dryRun?: boolean;
  }): Promise<PlaywrightRaiseResumeResult> {
    const res = await fetch(
      `${this.baseUrl()}/resumes/${input.externalId}/raise`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: input.dryRun }),
        signal: AbortSignal.timeout(90_000),
      },
    );
    return (await res.json()) as PlaywrightRaiseResumeResult;
  }

  async updateResume(input: {
    externalId: string;
    skills?: string[];
    about?: string;
    dryRun?: boolean;
  }): Promise<PlaywrightUpdateResumeResult> {
    const res = await fetch(
      `${this.baseUrl()}/resumes/${input.externalId}/update`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skills: input.skills,
          about: input.about,
          dryRun: input.dryRun,
        }),
        signal: AbortSignal.timeout(120_000),
      },
    );
    return (await res.json()) as PlaywrightUpdateResumeResult;
  }

  async listChats(): Promise<PlaywrightListChatsResult> {
    const res = await fetch(`${this.baseUrl()}/chats`, {
      signal: AbortSignal.timeout(90_000),
    });
    return (await res.json()) as PlaywrightListChatsResult;
  }

  async readChat(externalId: string): Promise<PlaywrightReadChatResult> {
    const res = await fetch(
      `${this.baseUrl()}/chats/${encodeURIComponent(externalId)}`,
      { signal: AbortSignal.timeout(90_000) },
    );
    return (await res.json()) as PlaywrightReadChatResult;
  }

  async sendChatMessage(input: {
    externalId: string;
    text: string;
    dryRun?: boolean;
  }): Promise<PlaywrightSendChatResult> {
    const res = await fetch(
      `${this.baseUrl()}/chats/${encodeURIComponent(input.externalId)}/send`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: input.text,
          dryRun: input.dryRun,
        }),
        signal: AbortSignal.timeout(90_000),
      },
    );
    return (await res.json()) as PlaywrightSendChatResult;
  }
}
