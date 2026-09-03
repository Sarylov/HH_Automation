import { HttpException, HttpStatus } from '@nestjs/common';
import { RaiseProfileResumeUseCase } from './raise-profile-resume.use-case';

function makeUseCase(playwright: Record<string, unknown>) {
  const config = { get: jest.fn().mockReturnValue('false') };
  return new RaiseProfileResumeUseCase(config as never, playwright as never);
}

describe('RaiseProfileResumeUseCase', () => {
  it('returns RAISED when the button was clicked', async () => {
    const playwright = {
      getAuthStatus: jest.fn().mockResolvedValue({ status: 'up' }),
      raiseProfileResume: jest.fn().mockResolvedValue({
        ok: true,
        raised: true,
        url: 'https://spb.hh.ru/applicant/profile/me',
      }),
    };

    const result = await makeUseCase(playwright).execute();

    expect(result).toMatchObject({ status: 'RAISED', raised: true });
    expect(playwright.raiseProfileResume).toHaveBeenCalledWith({
      dryRun: false,
    });
  });

  it('returns SKIPPED with the HH cooldown notice', async () => {
    const playwright = {
      getAuthStatus: jest.fn().mockResolvedValue({ status: 'up' }),
      raiseProfileResume: jest.fn().mockResolvedValue({
        ok: true,
        raised: false,
        skipped: true,
        reason: 'raise_cooldown',
        message: 'Вы подняли резюме сегодня в 17:02.',
      }),
    };

    const result = await makeUseCase(playwright).execute();

    expect(result).toMatchObject({
      status: 'SKIPPED',
      raised: false,
      reason: 'raise_cooldown',
      message: 'Вы подняли резюме сегодня в 17:02.',
    });
  });

  it('fails with 503 when the HH session is down', async () => {
    const playwright = {
      getAuthStatus: jest
        .fn()
        .mockResolvedValue({ status: 'down', reason: 'not_authenticated' }),
      raiseProfileResume: jest.fn(),
    };

    await expect(makeUseCase(playwright).execute()).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
    expect(playwright.raiseProfileResume).not.toHaveBeenCalled();
  });

  it('fails with 502 and a readable message when the button is missing', async () => {
    const playwright = {
      getAuthStatus: jest.fn().mockResolvedValue({ status: 'up' }),
      raiseProfileResume: jest.fn().mockResolvedValue({
        ok: false,
        reason: 'raise_button_not_found',
        screenshotPath: 'artifacts/resume-raise-profile-no-button-1.png',
      }),
    };

    const error: unknown = await makeUseCase(playwright)
      .execute()
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    const httpError = error as HttpException;
    expect(httpError.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    const body = httpError.getResponse() as {
      status: string;
      reason: string;
      message: string;
      screenshotPath: string;
    };
    expect(body).toMatchObject({
      status: 'FAILED',
      reason: 'raise_button_not_found',
      screenshotPath: 'artifacts/resume-raise-profile-no-button-1.png',
    });
    expect(body.message).toContain('Поднять в поиске');
  });
});
