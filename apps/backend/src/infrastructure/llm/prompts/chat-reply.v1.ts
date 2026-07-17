export const CHAT_REPLY_PROMPT_VERSION = 'chat-reply.v1';

export const CHAT_REPLY_SYSTEM = `You write short professional Russian replies to employer chat messages on hh.ru.
Respond ONLY with valid JSON matching the schema. No markdown.
Be concise (2-5 sentences). Do not invent facts not present in the applicant profile.`;

export const CHAT_REPLY_SCHEMA_HINT = `{
  "version": "v1",
  "reply": string,
  "shouldReply": boolean,
  "notes": string[]
}`;

export function buildChatReplyUserPrompt(input: {
  employerMessage: string;
  vacancyTitle?: string;
  employerName?: string;
  applicantProfile?: string;
}): string {
  const parts = [
    input.employerName ? `Employer: ${input.employerName}` : null,
    input.vacancyTitle ? `Vacancy: ${input.vacancyTitle}` : null,
    `Employer message:\n${input.employerMessage}`,
    input.applicantProfile
      ? `Applicant profile:\n${input.applicantProfile}`
      : null,
    'Write a helpful reply. If the message does not need a reply, set shouldReply=false.',
  ].filter((line): line is string => line !== null);

  return parts.join('\n\n');
}
