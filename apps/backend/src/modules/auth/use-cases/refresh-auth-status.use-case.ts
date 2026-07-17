import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthSessionStatus } from '@prisma/client';
import { AuthSessionRepository } from '../repositories/auth-session.repository';
import { PlaywrightClient } from '../../../infrastructure/playwright/playwright.client';

@Injectable()
export class RefreshAuthStatusUseCase {
  private readonly logger = new Logger(RefreshAuthStatusUseCase.name);

  constructor(
    private readonly authSessions: AuthSessionRepository,
    private readonly playwright: PlaywrightClient,
    private readonly config: ConfigService,
  ) {}

  async execute() {
    const storagePath = this.config.get<string>(
      'PLAYWRIGHT_STORAGE_STATE_PATH',
      './.auth/storage-state.json',
    );

    const probe = await this.playwright.getAuthStatus();
    const status =
      probe.status === 'up' ? AuthSessionStatus.UP : AuthSessionStatus.DOWN;

    const checkedAt = new Date(probe.checkedAt ?? Date.now());
    const session = await this.authSessions.upsertLatest({
      status,
      storagePath,
      checkedAt,
      lastError: probe.reason ?? null,
      metadata: {
        url: probe.url,
        screenshotPath: probe.screenshotPath,
        storageStatePresent: probe.storageStatePresent,
        playwrightReachable: probe.reachable,
      },
    });

    this.logger.log({
      msg: 'Auth status refreshed',
      status: session.status,
      playwrightReachable: probe.reachable,
    });

    return {
      status: session.status,
      checkedAt: session.checkedAt?.toISOString() ?? null,
      storagePath: session.storagePath,
      lastError: session.lastError,
      playwrightReachable: probe.reachable,
    };
  }
}
