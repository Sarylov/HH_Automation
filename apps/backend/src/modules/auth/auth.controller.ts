import { Controller, Get, Post } from '@nestjs/common';
import { GetAuthStatusUseCase } from './use-cases/get-auth-status.use-case';
import { RefreshAuthStatusUseCase } from './use-cases/refresh-auth-status.use-case';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly getAuthStatus: GetAuthStatusUseCase,
    private readonly refreshAuthStatus: RefreshAuthStatusUseCase,
  ) {}

  @Get('status')
  async status() {
    return this.getAuthStatus.execute();
  }

  @Post('refresh')
  async refresh() {
    return this.refreshAuthStatus.execute();
  }
}
