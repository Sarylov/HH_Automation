import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isDryRun } from '../../../infrastructure/config/dry-run';
import { PlaywrightClient } from '../../../infrastructure/playwright/playwright.client';

export type RaiseProfileResumeInput = {
  dryRun?: boolean;
  correlationId?: string;
};

export type RaiseProfileResumeResponse = {
  status: 'RAISED' | 'SKIPPED' | 'DRY_RUN';
  raised: boolean;
  reason?: string;
  message?: string;
  url?: string;
};

const FAILURE_MESSAGES: Record<string, string> = {
  not_authenticated:
    'HH session is not authenticated — refresh Playwright storageState (auth:manual)',
  session_not_up:
    'HH session is not authenticated — refresh Playwright storageState (auth:manual)',
  playwright_unreachable: 'Playwright service is unreachable',
  raise_button_not_found:
    'Profile page shows neither the "Поднять в поиске" button nor a cooldown marker ("Поднять автоматически" / recommendation text) — HH layout may have changed',
  raise_not_confirmed:
    'Clicked "Поднять в поиске", but HH did not confirm the raise',
};

const SESSION_FAILURE_REASONS = new Set([
  'not_authenticated',
  'session_not_up',
  'playwright_unreachable',
]);

export function describeRaiseFailure(reason: string, detail?: string): string {
  return FAILURE_MESSAGES[reason] ?? detail ?? `Resume raise failed: ${reason}`;
}

export function raiseFailureStatus(reason: string): HttpStatus {
  return SESSION_FAILURE_REASONS.has(reason)
    ? HttpStatus.SERVICE_UNAVAILABLE
    : HttpStatus.BAD_GATEWAY;
}

/**
 * Raises the resume from the HH applicant profile page.
 * Cooldown reported by HH is a valid outcome (SKIPPED), not an error.
 */
@Injectable()
export class RaiseProfileResumeUseCase {
  private readonly logger = new Logger(RaiseProfileResumeUseCase.name);

  constructor(
    private readonly config: ConfigService,
    private readonly playwright: PlaywrightClient,
  ) {}

  async execute(
    input: RaiseProfileResumeInput = {},
  ): Promise<RaiseProfileResumeResponse> {
    const dryRun = input.dryRun ?? isDryRun(this.config);
    const correlationId = input.correlationId;

    this.logger.log({
      msg: 'Profile resume raise started',
      dryRun,
      correlationId,
    });

    const auth = await this.playwright.getAuthStatus();
    if (auth.status !== 'up') {
      const reason = auth.reason ?? 'session_not_up';
      this.logger.warn({
        msg: 'Profile resume raise blocked — session down',
        reason,
        sessionStatus: auth.status,
        correlationId,
      });
      throw new HttpException(
        {
          status: 'FAILED',
          raised: false,
          reason,
          message: describeRaiseFailure(reason),
          sessionStatus: auth.status,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const result = await this.playwright.raiseProfileResume({ dryRun });

    if (!result.ok) {
      const reason = result.reason ?? 'raise_failed';
      const message = describeRaiseFailure(reason, result.message);
      this.logger.error({
        msg: 'Profile resume raise failed',
        reason,
        url: result.url,
        screenshotPath: result.screenshotPath,
        correlationId,
      });
      throw new HttpException(
        {
          status: 'FAILED',
          raised: false,
          reason,
          message,
          url: result.url,
          screenshotPath: result.screenshotPath,
        },
        raiseFailureStatus(reason),
      );
    }

    if (result.skipped) {
      this.logger.log({
        msg: 'Profile resume raise skipped',
        reason: result.reason,
        message: result.message,
        correlationId,
      });
      return {
        status: 'SKIPPED',
        raised: false,
        reason: result.reason ?? 'raise_cooldown',
        message: result.message,
        url: result.url,
      };
    }

    if (result.dryRun) {
      return {
        status: 'DRY_RUN',
        raised: false,
        reason: result.reason ?? 'dry_run',
        url: result.url,
      };
    }

    this.logger.log({
      msg: 'Profile resume raised',
      message: result.message,
      correlationId,
    });

    return {
      status: 'RAISED',
      raised: true,
      message: result.message,
      url: result.url,
    };
  }
}
