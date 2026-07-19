import { apiGet, toQuery } from './client';
import type { ApplicationItem, Paginated } from '../types/api';

export function fetchApplications(params: {
  status?: string;
  limit?: number;
  cursor?: string;
}): Promise<Paginated<ApplicationItem>> {
  return apiGet(`/api/applications${toQuery(params)}`);
}

export function fetchApplication(id: string): Promise<ApplicationItem> {
  return apiGet(`/api/applications/${id}`);
}
