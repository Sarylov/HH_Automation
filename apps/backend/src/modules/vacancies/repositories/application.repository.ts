import { Injectable } from '@nestjs/common';

import {

  ApplicationStatus,

  Prisma,

  type Application,

} from '@prisma/client';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';



@Injectable()

export class ApplicationRepository {

  constructor(private readonly prisma: PrismaService) {}



  async findByVacancyId(vacancyId: string): Promise<Application | null> {

    return this.prisma.application.findUnique({ where: { vacancyId } });

  }



  async upsertStub(input: {

    vacancyId: string;

    correlationId?: string;

    errorMessage?: string | null;

    status?: ApplicationStatus;

  }): Promise<Application> {

    return this.prisma.application.upsert({

      where: { vacancyId: input.vacancyId },

      create: {

        vacancyId: input.vacancyId,

        status: input.status ?? ApplicationStatus.STUB,

        correlationId: input.correlationId,

        errorMessage: input.errorMessage ?? null,

        appliedAt: new Date(),

      },

      update: {

        status: input.status ?? ApplicationStatus.STUB,

        correlationId: input.correlationId,

        errorMessage: input.errorMessage ?? null,

        appliedAt: new Date(),

      },

    });

  }



  async upsertResult(input: {

    vacancyId: string;

    status: ApplicationStatus;

    coverLetter?: string | null;

    analysis?: Prisma.InputJsonValue;

    correlationId?: string;

    errorMessage?: string | null;

    appliedAt?: Date | null;

  }): Promise<Application> {

    return this.prisma.application.upsert({

      where: { vacancyId: input.vacancyId },

      create: {

        vacancyId: input.vacancyId,

        status: input.status,

        coverLetter: input.coverLetter ?? null,

        analysis: input.analysis,

        correlationId: input.correlationId,

        errorMessage: input.errorMessage ?? null,

        appliedAt: input.appliedAt ?? null,

      },

      update: {

        status: input.status,

        coverLetter: input.coverLetter ?? null,

        analysis: input.analysis,

        correlationId: input.correlationId,

        errorMessage: input.errorMessage ?? null,

        appliedAt: input.appliedAt ?? null,

      },

    });

  }

}

