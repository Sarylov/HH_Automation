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

describe('ApplyJobRepository.list', () => {
  it('returns page and nextCursor when more rows exist', async () => {
    const vacancy = {
      id: 'vac-1',
      title: 'Dev',
      company: 'Acme',
      url: 'https://hh.ru/1',
      salary: null,
    };
    const row = {
      id: 'job-1',
      vacancyId: 'vac-1',
      status: ApplyJobStatus.PENDING,
      attempts: 0,
      lastError: null,
      correlationId: null,
      queuedAt: new Date('2026-07-19T10:00:00.000Z'),
      startedAt: null,
      finishedAt: null,
      createdAt: new Date('2026-07-19T10:00:00.000Z'),
      updatedAt: new Date('2026-07-19T10:00:00.000Z'),
      vacancy,
    };
    const findMany = jest.fn().mockResolvedValue([row, { ...row, id: 'job-2' }]);
    const repo = new ApplyJobRepository(
      { applyJob: { findMany } } as never,
      { get: () => '30' } as never,
    );

    const result = await repo.list({ limit: 1 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe('job-1');
    expect(result.nextCursor).toBeTruthy();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 2 }),
    );
  });
});
