import { Test, TestingModule } from '@nestjs/testing';
import { GetApplicationSummaryUseCase } from './get-application-summary.use-case';
import { ApplicationRepository } from '../repositories/application.repository';

describe('GetApplicationSummaryUseCase', () => {
  let useCase: GetApplicationSummaryUseCase;
  const daySummary = jest.fn();

  beforeEach(async () => {
    daySummary.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetApplicationSummaryUseCase,
        {
          provide: ApplicationRepository,
          useValue: { daySummary },
        },
      ],
    }).compile();

    useCase = module.get(GetApplicationSummaryUseCase);
  });

  it('defaults to today when date is omitted', async () => {
    const summary = {
      date: '2026-09-01',
      total: 3,
      succeeded: 2,
      failed: 1,
      warnings: 0,
    };
    daySummary.mockResolvedValue(summary);

    await expect(useCase.execute()).resolves.toEqual(summary);
    expect(daySummary).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });

  it('passes explicit date through', async () => {
    const summary = {
      date: '2026-08-30',
      total: 1,
      succeeded: 1,
      failed: 0,
      warnings: 0,
    };
    daySummary.mockResolvedValue(summary);

    await expect(useCase.execute({ date: '2026-08-30' })).resolves.toEqual(
      summary,
    );
    expect(daySummary).toHaveBeenCalledWith('2026-08-30');
  });
});
