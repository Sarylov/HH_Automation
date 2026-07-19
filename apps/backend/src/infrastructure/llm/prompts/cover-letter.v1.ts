export const COVER_LETTER_PROMPT_VERSION = 'cover-letter.v1';

export const COVER_LETTER_SYSTEM = `You write concise Russian cover letters for hh.ru job applications.
Personalize to the vacancy: mirror key requirements, emphasize overlapping skills, stay honest.
Respond ONLY with valid JSON matching the schema. No markdown.`;

export const COVER_LETTER_SCHEMA_HINT = `{
  "version": "v1",
  "letter": string (Russian, 80-180 words, professional tone),
  "highlights": string[],
  "wordCount": number
}`;

export function buildCoverLetterUserPrompt(input: {
  title: string;
  company?: string;
  description?: string;
  analysisSummary: string;
  matchScore: number;
  applicantProfile?: string;
}): string {
  const parts = [
    `Vacancy: ${input.title}`,
    input.company ? `Company: ${input.company}` : null,
    input.description ? `Description:\n${input.description}` : null,
    `Fit summary (for personalization): ${input.analysisSummary}`,
    `Match score (informational): ${input.matchScore}`,
    input.applicantProfile
      ? `Applicant profile:\n${input.applicantProfile}`
      : null,
    'Write a tailored cover letter in Russian. Emphasize relevant overlap; do not invent experience.',
  ].filter((line): line is string => line !== null);

  return parts.join('\n\n');
}
