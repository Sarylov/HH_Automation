import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { LlmModule } from './infrastructure/llm/llm.module';
import { HardeningModule } from './modules/hardening/hardening.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { VacanciesModule } from './modules/vacancies/vacancies.module';
import { ResumesModule } from './modules/resumes/resumes.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        autoLogging: true,
      },
    }),
    PrismaModule,
    LlmModule,
    HardeningModule,
    AuthModule,
    VacanciesModule,
    ResumesModule,
    MessagingModule,
    HealthModule,
    MetricsModule,
    WorkflowsModule,
  ],
})
export class AppModule {}
