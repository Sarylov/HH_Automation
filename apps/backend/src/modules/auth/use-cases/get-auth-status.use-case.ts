import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthSessionStatus } from '@prisma/client';
import { AuthSessionRepository } from '../repositories/auth-session.repository';

@Injectable()
export class GetAuthStatusUseCase {
  private readonly logger = new Logger(GetAuthStatusUseCase.name);

  constructor(
    private readonly authSessions: AuthSessionRepository,
    private readonly config: ConfigService,
  ) {}

  async execute() {
    const session = await this.authSessions.getLatest();
    const storagePath =
      session?.storagePath ??
      this.config.get<string>(
        'PLAYWRIGHT_STORAGE_STATE_PATH',
        './.auth/storage-state.json',
      );

    this.logger.log({ msg: 'Auth status read', status: session?.status });

    return {
      status: session?.status ?? AuthSessionStatus.UNKNOWN,
      checkedAt: session?.checkedAt?.toISOString() ?? null,
      storagePath,
      lastError: session?.lastError ?? null,
    };
  }
}
