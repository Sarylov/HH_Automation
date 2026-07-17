export const VACANCY_ANALYSIS_PROMPT_VERSION = 'vacancy-analysis.v1';

export const VACANCY_ANALYSIS_SYSTEM = `You analyze job vacancies for a frontend developer candidate.
Respond ONLY with valid JSON matching the schema. No markdown.`;

export const VACANCY_ANALYSIS_SCHEMA_HINT = `{
  "version": "v1",
  "shouldApply": boolean,
  "matchScore": number (0-100),
  "reasons": string[],
  "redFlags": string[],
  "requiredSkills": string[],
  "summary": string
}`;

export function buildVacancyAnalysisUserPrompt(input: {
  title: string;
  company?: string;
  salary?: string;
  snippet?: string;
  description?: string;
  searchText?: string;
  excludedText?: string;
  applicantProfile?: string;
}): string {
  const parts = [
    `Vacancy title: ${input.title}`,
    input.company ? `Company: ${input.company}` : null,
    input.salary ? `Salary: ${input.salary}` : null,
    input.snippet ? `Snippet: ${input.snippet}` : null,
    input.description ? `Description:\n${input.description}` : null,
    input.searchText ? `Candidate search focus: ${input.searchText}` : null,
    input.excludedText
      ? `Exclude roles containing: ${input.excludedText}`
      : null,
    input.applicantProfile
      ? `Applicant profile:\n${input.applicantProfile}`
      : null,
    'Decide if the candidate should apply. Penalize backend/fullstack-only roles.',
  ].filter((line): line is string => line !== null);

  return parts.join('\n\n');
}
