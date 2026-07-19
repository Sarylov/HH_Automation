import { ApplyJobStatus } from '@prisma/client';
import { ApplyJobRepository } from './apply-job.repository';

describe('ApplyJobRepository.claimOldestPending', () => {
  it('returns null when queue is empty', async () => {
    const prisma = {
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          applyJob: {
            findFirst: jest.fn().mockResolvedValue(null),
            updateMany: jest.fn(),
            findUnique: jest.fn(),
          },
        }),
      ),
    };
    const config = { get: () => '30' };
    const repo = new ApplyJobRepository(
      prisma as never,
      config as never,
    );

    await expect(repo.claimOldestPending()).resolves.toBeNull();
  });

  it('claims oldest pending atomically', async () => {
    const job = {
      id: 'job-1',
      vacancyId: 'vac-1',
      status: ApplyJobStatus.PENDING,
      createdAt: new Date(),
    };
    const claimed = { ...job, status: ApplyJobStatus.RUNNING };
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const findUnique = jest.fn().mockResolvedValue(claimed);
    const prisma = {
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          applyJob: {
            findFirst: jest.fn().mockResolvedValue(job),
            updateMany,
            findUnique,
          },
        }),
      ),
    };
    const config = { get: () => '30' };
    const repo = new ApplyJobRepository(
      prisma as never,
      config as never,
    );

    const result = await repo.claimOldestPending();
    expect(result).toEqual(claimed);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1', status: ApplyJobStatus.PENDING },
      }),
    );
  });

  it('returns null when race loses updateMany', async () => {
    const job = {
      id: 'job-1',
      vacancyId: 'vac-1',
      status: ApplyJobStatus.PENDING,
    };
    const prisma = {
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          applyJob: {
            findFirst: jest.fn().mockResolvedValue(job),
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            findUnique: jest.fn(),
          },
        }),
      ),
    };
    const repo = new ApplyJobRepository(
      prisma as never,
      { get: () => '30' } as never,
    );

    await expect(repo.claimOldestPending()).resolves.toBeNull();
  });
});
