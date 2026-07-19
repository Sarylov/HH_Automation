import type { ApplyJobWithVacancy } from '../repositories/apply-job.repository';
import type { ApplicationWithVacancy } from '../repositories/application.repository';

export type VacancySummaryDto = {
  id: string;
  title: string;
  company: string | null;
  url: string;
  salary: string | null;
};

export type ApplyJobListItemDto = {
  id: string;
  status: string;
  attempts: number;
  lastError: string | null;
  correlationId: string | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  vacancy: VacancySummaryDto;
};

export type ApplicationListItemDto = {
  id: string;
  status: string;
  coverLetter: string | null;
  errorMessage: string | null;
  correlationId: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  vacancy: VacancySummaryDto;
};

function mapVacancy(
  vacancy: ApplyJobWithVacancy['vacancy'] | ApplicationWithVacancy['vacancy'],
): VacancySummaryDto {
  return {
    id: vacancy.id,
    title: vacancy.title,
    company: vacancy.company,
    url: vacancy.url,
    salary: vacancy.salary,
  };
}

export function mapApplyJobItem(row: ApplyJobWithVacancy): ApplyJobListItemDto {
  return {
    id: row.id,
    status: row.status,
    attempts: row.attempts,
    lastError: row.lastError,
    correlationId: row.correlationId,
    queuedAt: row.queuedAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    vacancy: mapVacancy(row.vacancy),
  };
}

export function mapApplicationItem(
  row: ApplicationWithVacancy,
): ApplicationListItemDto {
  return {
    id: row.id,
    status: row.status,
    coverLetter: row.coverLetter,
    errorMessage: row.errorMessage,
    correlationId: row.correlationId,
    appliedAt: row.appliedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    vacancy: mapVacancy(row.vacancy),
  };
}
