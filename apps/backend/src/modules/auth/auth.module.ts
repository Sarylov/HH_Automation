import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { GetAuthStatusUseCase } from './use-cases/get-auth-status.use-case';
import { RefreshAuthStatusUseCase } from './use-cases/refresh-auth-status.use-case';
import { AuthSessionRepository } from './repositories/auth-session.repository';
import { PlaywrightClient } from '../../infrastructure/playwright/playwright.client';

@Module({
  controllers: [AuthController],
  providers: [
    GetAuthStatusUseCase,
    RefreshAuthStatusUseCase,
    AuthSessionRepository,
    PlaywrightClient,
  ],
  exports: [GetAuthStatusUseCase, AuthSessionRepository, PlaywrightClient],
})
export class AuthModule {}
