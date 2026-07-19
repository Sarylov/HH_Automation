import { ApplyJobStatus } from '@prisma/client';
import { ApplyNextUseCase } from './apply-next.use-case';

describe('ApplyNextUseCase', () => {
  it('returns EMPTY when no jobs', async () => {
    const applyJobs = {
      findStuckRunning: jest.fn().mockResolvedValue(null),
      claimOldestPending: jest.fn().mockResolvedValue(null),
      findById: jest.fn(),
    };
    const applyToVacancy = { execute: jest.fn() };
    const workingHours = {
      evaluate: () => ({ allowed: true }),
    };
    const rateLimit = {
      checkApplyAllowed: jest.fn().mockResolvedValue({ allowed: true }),
    };
    const useCase = new ApplyNextUseCase(
      applyJobs as never,
      applyToVacancy as never,
      workingHours as never,
      rateLimit as never,
    );

    const result = await useCase.execute();
    expect(result).toMatchObject({ status: 'EMPTY' });
    expect(applyToVacancy.execute).not.toHaveBeenCalled();
  });

  it('resumes by applyJobId without claiming another', async () => {
    const job = {
      id: 'job-1',
      vacancyId: 'vac-1',
      status: ApplyJobStatus.RUNNING,
    };
    const applyJobs = {
      findById: jest.fn().mockResolvedValue(job),
      findStuckRunning: jest.fn(),
      claimOldestPending: jest.fn(),
      markRunning: jest.fn(),
    };
    const applyToVacancy = {
      execute: jest.fn().mockResolvedValue({
        accepted: true,
        status: 'SUCCEEDED',
      }),
    };
    const workingHours = {
      evaluate: () => ({ allowed: true }),
    };
    const rateLimit = {
      checkApplyAllowed: jest.fn().mockResolvedValue({ allowed: true }),
    };
    const useCase = new ApplyNextUseCase(
      applyJobs as never,
      applyToVacancy as never,
      workingHours as never,
      rateLimit as never,
    );

    const result = await useCase.execute({ applyJobId: 'job-1' });
    expect(applyJobs.claimOldestPending).not.toHaveBeenCalled();
    expect(applyToVacancy.execute).toHaveBeenCalledWith({
      vacancyId: 'vac-1',
      applyJobId: 'job-1',
      correlationId: undefined,
    });
    expect(result).toMatchObject({
      workflow: 'apply-next',
      applyJobId: 'job-1',
      vacancyId: 'vac-1',
    });
  });
});
