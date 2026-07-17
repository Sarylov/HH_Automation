export const COVER_LETTER_PROMPT_VERSION = 'cover-letter.v1';

export const COVER_LETTER_SYSTEM = `You write concise Russian cover letters for hh.ru job applications.
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
    `Fit summary: ${input.analysisSummary}`,
    `Match score: ${input.matchScore}`,
    input.applicantProfile
      ? `Applicant profile:\n${input.applicantProfile}`
      : null,
    'Write a tailored cover letter in Russian. Mention relevant skills only.',
  ].filter((line): line is string => line !== null);

  return parts.join('\n\n');
}
