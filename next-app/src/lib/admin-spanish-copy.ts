export type SpanishCopySource = {
  title?: string | null;
  title_es?: string | null;
  description?: string | null;
  description_es?: string | null;
  public_notes?: string | null;
  public_notes_es?: string | null;
};

export type SpanishCopyTarget = 'title_es' | 'description_es' | 'public_notes_es';

export type SpanishTranslationResponse = {
  title_es?: string | null;
  description_es?: string | null;
  notes_es?: string | null;
};

export type MissingSpanishCopyRequest = {
  body: {
    title: string;
    description: string;
    notes: string;
  };
  targets: SpanishCopyTarget[];
};

const hasText = (value: string | null | undefined) => Boolean(value?.trim());

export function buildMissingSpanishCopyRequest(copy: SpanishCopySource): MissingSpanishCopyRequest {
  const needsTitle = hasText(copy.title) && !hasText(copy.title_es);
  const needsDescription = hasText(copy.description) && !hasText(copy.description_es);
  const needsNotes = hasText(copy.public_notes) && !hasText(copy.public_notes_es);
  const targets: SpanishCopyTarget[] = [];

  if (needsTitle) targets.push('title_es');
  if (needsDescription) targets.push('description_es');
  if (needsNotes) targets.push('public_notes_es');

  return {
    body: {
      title: needsTitle ? copy.title?.trim() ?? '' : '',
      description: needsDescription ? copy.description?.trim() ?? '' : '',
      notes: needsNotes ? copy.public_notes?.trim() ?? '' : '',
    },
    targets,
  };
}

export function mergeMissingSpanishCopy<T extends SpanishCopySource>(
  current: T,
  request: MissingSpanishCopyRequest,
  translated: SpanishTranslationResponse,
): T {
  const next = { ...current };
  const titleIsCurrent = current.title?.trim() === request.body.title;
  const descriptionIsCurrent = current.description?.trim() === request.body.description;
  const notesAreCurrent = current.public_notes?.trim() === request.body.notes;

  if (request.targets.includes('title_es') && titleIsCurrent && !hasText(current.title_es) && hasText(translated.title_es)) {
    next.title_es = translated.title_es!.trim();
  }
  if (request.targets.includes('description_es') && descriptionIsCurrent && !hasText(current.description_es) && hasText(translated.description_es)) {
    next.description_es = translated.description_es!.trim();
  }
  if (request.targets.includes('public_notes_es') && notesAreCurrent && !hasText(current.public_notes_es) && hasText(translated.notes_es)) {
    next.public_notes_es = translated.notes_es!.trim();
  }

  return next;
}

export function translatedSpanishTargets(
  requestedTargets: SpanishCopyTarget[],
  translated: SpanishTranslationResponse,
): SpanishCopyTarget[] {
  return requestedTargets.filter((target) => {
    if (target === 'public_notes_es') return hasText(translated.notes_es);
    return hasText(translated[target]);
  });
}
