// English -> Spanish translation for product copy (title + description).
// Used by the "English now, Spanish on save" flow: the listing AI generates English
// only, and this fills the Spanish fields at save time.
//
// Anthropic-only for now (matches the configured provider). Set AI_TRANSLATE_MODEL to a
// fast model (e.g. claude-haiku-4-5-20251001) to keep saves snappy; otherwise falls back
// to AI_MODEL.

const TRANSLATE_TIMEOUT_MS = 20000;
const MAX_TITLE_LENGTH = 180;
const MAX_DESCRIPTION_LENGTH = 2400;

export type TranslateProductCopyInput = { title?: string | null; description?: string | null; notes?: string | null };
export type TranslateProductCopyResult = { title_es: string | null; description_es: string | null; notes_es: string | null };

const TRANSLATE_SYSTEM_PROMPT = `You are a professional English-to-Spanish translator for a fine estate jewelry shop in Naples, Florida. Translate the provided product copy into natural, professional Latin American Spanish appropriate for a US jewelry storefront. Keep brand names, proper nouns, karat marks (e.g. 14K), measurements, and numbers exactly as written. Do not add, remove, or invent information. Respond with a single raw JSON object (no markdown), shaped exactly: {"title_es": string|null, "description_es": string|null, "notes_es": string|null}. Use null for any input that was null or empty.`;

function parseTranslationJson(text: string): { title_es?: unknown; description_es?: unknown; notes_es?: unknown } | null {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function cleanTranslated(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

export async function translateProductCopyToSpanish(
  input: TranslateProductCopyInput,
): Promise<TranslateProductCopyResult> {
  const title = (input.title ?? '').trim();
  const description = (input.description ?? '').trim();
  const notes = (input.notes ?? '').trim();
  if (!title && !description && !notes) return { title_es: null, description_es: null, notes_es: null };

  const provider = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (provider !== 'anthropic') {
    throw new Error('Translation is only configured for the Anthropic provider.');
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = (process.env.AI_TRANSLATE_MODEL || process.env.AI_MODEL || '').trim();
  if (!apiKey) throw new Error('Anthropic API key is not configured.');
  if (!model) throw new Error('AI translation model is not configured.');

  const userPrompt = JSON.stringify({
    task: 'translate_product_copy_to_spanish',
    title: title || null,
    description: description || null,
    notes: notes || null,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.AI_TIMEOUT_MS ?? TRANSLATE_TIMEOUT_MS));
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': process.env.ANTHROPIC_VERSION ?? '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: Number(process.env.AI_TRANSLATE_MAX_TOKENS ?? 1200),
        temperature: 0,
        system: [{ type: 'text', text: TRANSLATE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: [{ type: 'text', text: userPrompt }] }],
      }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error?.message ?? `Translation request failed with status ${response.status}.`);
    }
    const text = Array.isArray(data?.content)
      ? data.content.map((part: { text?: string }) => part.text ?? '').join('\n')
      : '';
    const parsed = parseTranslationJson(text);
    return {
      title_es: title ? cleanTranslated(parsed?.title_es, MAX_TITLE_LENGTH) : null,
      description_es: description ? cleanTranslated(parsed?.description_es, MAX_DESCRIPTION_LENGTH) : null,
      notes_es: notes ? cleanTranslated(parsed?.notes_es, MAX_DESCRIPTION_LENGTH) : null,
    };
  } finally {
    clearTimeout(timeout);
  }
}
