import { apiGet } from './client';
import type { Metrics } from '../types/api';

export function fetchMetrics(): Promise<Metrics> {
  return apiGet('/api/metrics');
}
