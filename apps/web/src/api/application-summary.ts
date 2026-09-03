import { apiGet, toQuery } from './client';

export type ApplicationSummary = {
  date: string;
  total: number;
  succeeded: number;
  failed: number;
  warnings: number;
};

export function fetchApplicationSummary(params: {
  date?: string;
}): Promise<ApplicationSummary> {
  return apiGet(`/api/applications/summary${toQuery(params)}`);
}
