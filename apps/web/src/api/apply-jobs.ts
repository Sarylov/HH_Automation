import { apiGet, toQuery } from './client';
import type { ApplyJobItem, Paginated } from '../types/api';

export function fetchApplyJobs(params: {
  status?: string;
  limit?: number;
  cursor?: string;
}): Promise<Paginated<ApplyJobItem>> {
  return apiGet(`/api/apply-jobs${toQuery(params)}`);
}
