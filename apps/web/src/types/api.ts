export type VacancySummary = {
  id: string;
  title: string;
  company: string | null;
  url: string;
  salary: string | null;
};

export type ApplyJobItem = {
  id: string;
  status: string;
  attempts: number;
  lastError: string | null;
  correlationId: string | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  vacancy: VacancySummary;
};

export type ApplicationItem = {
  id: string;
  status: string;
  coverLetter: string | null;
  errorMessage: string | null;
  correlationId: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  vacancy: VacancySummary;
};

export type Paginated<T> = {
  items: T[];
  nextCursor: string | null;
};

export type Metrics = {
  timestamp: string;
  applies: {
    succeededToday: number;
    failedToday: number;
    needsManualToday: number;
  };
  workflows: {
    failedToday: number;
    succeededToday: number;
  };
  queue: {
    pending: number;
    running: number;
    failed: number;
  };
  session: {
    status: 'up' | 'down' | 'unknown';
    ageHours: number | null;
    checkedAt: string | null;
    stale: boolean;
  };
  rateLimit: {
    hourCount: number;
    dayCount: number;
    hourLimit: number;
    dayLimit: number;
  };
  alerts: string[];
};
