export const APPLY_QUEUE = 'apply';

export type ApplyJobPayload = {
  applyJobId: string;
  vacancyId: string;
  externalId: string;
  correlationId?: string;
};
