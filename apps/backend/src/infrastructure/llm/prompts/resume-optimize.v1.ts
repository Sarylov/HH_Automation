export const RESUME_OPTIMIZE_PROMPT_VERSION = 'resume-optimize.v1';

export const RESUME_OPTIMIZE_SYSTEM = `You suggest conservative resume skill updates for a frontend developer.
Respond ONLY with valid JSON matching the schema. No markdown.
Only propose skills clearly supported by market demand and the candidate profile.
Do not invent experience. Prefer adding missing in-demand skills already implied by the profile.`;

export const RESUME_OPTIMIZE_SCHEMA_HINT = `{
  "version": "v1",
  "skillsToAdd": string[],
  "skillsToRemove": string[],
  "aboutHint": string | null,
  "rationale": string[],
  "shouldUpdate": boolean
}`;

export function buildResumeOptimizeUserPrompt(input: {
  title?: string;
  currentSkills: string[];
  about?: string;
  marketSkills: string[];
  applicantProfile?: string;
}): string {
  const parts = [
    input.title ? `Resume title: ${input.title}` : null,
    `Current skills:\n${input.currentSkills.join(', ') || '(none)'}`,
    input.about ? `About:\n${input.about}` : null,
    `Top market skills from recent vacancies:\n${input.marketSkills.join(', ') || '(none)'}`,
    input.applicantProfile
      ? `Applicant profile:\n${input.applicantProfile}`
      : null,
    'Propose a small skill diff (max 8 adds, max 3 removes). Set shouldUpdate=false if no meaningful change.',
  ].filter((line): line is string => line !== null);

  return parts.join('\n\n');
}
