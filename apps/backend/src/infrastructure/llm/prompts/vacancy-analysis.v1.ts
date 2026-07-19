export const VACANCY_ANALYSIS_PROMPT_VERSION = 'vacancy-analysis.v1';

export const VACANCY_ANALYSIS_SYSTEM = `You analyze job vacancies to help write a tailored cover letter for a frontend developer candidate.
The application will proceed regardless of fit — focus on useful summary and skills mapping.
Respond ONLY with valid JSON matching the schema. No markdown.`;

export const VACANCY_ANALYSIS_SCHEMA_HINT = `{
  "version": "v1",
  "shouldApply": boolean (informational only; prefer true unless the role is clearly not frontend),
  "matchScore": number (0-100),
  "reasons": string[],
  "redFlags": string[],
  "requiredSkills": string[],
  "summary": string (what to emphasize in a cover letter)
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
      ? `Search excluded terms (context): ${input.excludedText}`
      : null,
    input.applicantProfile
      ? `Applicant profile:\n${input.applicantProfile}`
      : null,
    'Summarize fit and key skills to highlight. Do not decide whether to apply — that is handled elsewhere.',
  ].filter((line): line is string => line !== null);

  return parts.join('\n\n');
}
