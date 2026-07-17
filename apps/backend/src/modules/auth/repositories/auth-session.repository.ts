import { Injectable } from '@nestjs/common';
import {
  AuthSessionStatus,
  Prisma,
  type AuthSession,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class AuthSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getLatest(): Promise<AuthSession | null> {
    return this.prisma.authSession.findFirst({
      orderBy: { updatedAt: 'desc' },
    });
  }

  async upsertLatest(input: {
    status: AuthSessionStatus;
    storagePath: string;
    checkedAt: Date;
    lastError?: string | null;
    metadata?: Prisma.InputJsonValue;
  }): Promise<AuthSession> {
    const existing = await this.getLatest();
    if (existing) {
      return this.prisma.authSession.update({
        where: { id: existing.id },
        data: {
          status: input.status,
          storagePath: input.storagePath,
          checkedAt: input.checkedAt,
          lastError: input.lastError ?? null,
          metadata: input.metadata,
        },
      });
    }

    return this.prisma.authSession.create({
      data: {
        status: input.status,
        storagePath: input.storagePath,
        checkedAt: input.checkedAt,
        lastError: input.lastError ?? null,
        metadata: input.metadata,
      },
    });
  }
}
