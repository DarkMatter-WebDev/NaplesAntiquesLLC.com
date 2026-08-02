export const MAX_AI_SPEECH_TEXT_LENGTH = 3600;

export type AiSpeechTextResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export function parseAiSpeechText(value: unknown): AiSpeechTextResult {
  if (typeof value !== 'string') {
    return { ok: false, error: 'A response is required for read aloud.' };
  }

  const text = value
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    return { ok: false, error: 'A response is required for read aloud.' };
  }
  if (text.length > MAX_AI_SPEECH_TEXT_LENGTH) {
    return {
      ok: false,
      error: `The response is too long to read aloud. Limit is ${MAX_AI_SPEECH_TEXT_LENGTH} characters.`,
    };
  }

  return { ok: true, text };
}
