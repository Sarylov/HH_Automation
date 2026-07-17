import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { APPLY_QUEUE, type ApplyJobPayload } from './queue.constants';

@Injectable()
export class ApplyQueueService {
  private readonly logger = new Logger(ApplyQueueService.name);

  constructor(@InjectQueue(APPLY_QUEUE) private readonly queue: Queue) {}

  async enqueue(payload: ApplyJobPayload): Promise<string> {
    const job = await this.queue.add('apply', payload, {
      jobId: payload.applyJobId,
      removeOnComplete: 100,
      removeOnFail: 200,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
    });
    this.logger.log({
      msg: 'Apply job enqueued',
      bullJobId: job.id,
      applyJobId: payload.applyJobId,
      externalId: payload.externalId,
    });
    return String(job.id);
  }
}
