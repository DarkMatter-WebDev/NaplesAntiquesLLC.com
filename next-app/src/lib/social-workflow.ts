/** The owner-facing stage of a social post's review-first workflow. */
export type SocialWorkflowStage = 'curate' | 'prepare' | 'update' | 'review' | 'published';

export function getSocialUnqueuedSyncState(
  postedCaption: string | null | undefined,
  renditionPaths: readonly string[] | null | undefined,
): 'review' | 'pending' {
  return postedCaption && renditionPaths?.length ? 'review' : 'pending';
}

/**
 * Keeps the two social panels on one deliberate path:
 * curate/save → prepare → review/queue/publish. Local photo edits always win
 * over an older prepared upload, so downstream actions cannot leap past them.
 */
export function getSocialWorkflowStage({
  isPublished,
  lineupDirty,
  hasPreparedUpload,
  captionOpeningDirty,
  isEditingSetup = false,
  isEditingCaption = false,
}: {
  isPublished: boolean;
  lineupDirty: boolean;
  hasPreparedUpload: boolean;
  captionOpeningDirty: boolean;
  isEditingSetup?: boolean;
  isEditingCaption?: boolean;
}): SocialWorkflowStage {
  if (isPublished) return 'published';
  if (isEditingSetup || lineupDirty) return 'curate';
  // Before any upload exists, an opening edit belongs to setup, never to an
  // impossible “update prepared upload” step.
  if (!hasPreparedUpload) return isEditingCaption || captionOpeningDirty ? 'curate' : 'prepare';
  if (isEditingCaption || captionOpeningDirty) return 'update';
  return 'review';
}
