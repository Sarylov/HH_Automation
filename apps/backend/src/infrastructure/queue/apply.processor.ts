import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { APPLY_QUEUE, type ApplyJobPayload } from './queue.constants';
import { ApplyToVacancyUseCase } from '../../modules/vacancies/use-cases/apply-to-vacancy.use-case';

@Processor(APPLY_QUEUE, {
  concurrency: 1,
  limiter: { max: 1, duration: 10_000 },
})
export class ApplyProcessor extends WorkerHost {
  private readonly logger = new Logger(ApplyProcessor.name);

  constructor(private readonly applyToVacancy: ApplyToVacancyUseCase) {
    super();
  }

  async process(job: Job<ApplyJobPayload>): Promise<unknown> {
    this.logger.log({
      msg: 'Processing apply job',
      bullJobId: job.id,
      applyJobId: job.data.applyJobId,
    });
    return this.applyToVacancy.execute({
      vacancyId: job.data.vacancyId,
      applyJobId: job.data.applyJobId,
      correlationId: job.data.correlationId,
    });
  }
}
