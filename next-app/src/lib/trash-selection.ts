// Multi-select for the Orders Recycle Bin (owner ask, 2026-09-16): a checkbox
// per row, one in the column header that selects every VISIBLE row, and one
// "Delete … Forever" button for the selection. Pure helpers so the rules are
// testable without the panel: "all" always means "all rows currently shown"
// (search/filters applied), never rows off-screen, and the confirm text says
// exactly how many orders are about to go and whether that is everything.

export type SelectionState = {
  /** Selected ids that are still visible. */
  ids: string[];
  count: number;
  /** Every visible row is selected (and there is at least one). */
  all: boolean;
  /** At least one but not every visible row is selected. */
  some: boolean;
};

export const EMPTY_SELECTION: SelectionState = { ids: [], count: 0, all: false, some: false };

/** The selection intersected with what is on screen right now. */
export function selectionState(visibleIds: readonly string[], selected: ReadonlySet<string>): SelectionState {
  const ids = visibleIds.filter((id) => selected.has(id));
  const count = ids.length;
  return {
    ids,
    count,
    all: count > 0 && count === visibleIds.length,
    some: count > 0 && count < visibleIds.length,
  };
}

export function toggleId(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/**
 * Header checkbox: if every visible row is selected, clear them; otherwise
 * select every visible row (a partial selection becomes a full one, the way
 * mail clients behave). Rows not on screen are left as they were.
 */
export function toggleAll(selected: ReadonlySet<string>, visibleIds: readonly string[]): Set<string> {
  const next = new Set(selected);
  const { all } = selectionState(visibleIds, selected);
  for (const id of visibleIds) {
    if (all) next.delete(id);
    else next.add(id);
  }
  return next;
}

export function bulkDeleteLabel(state: SelectionState): string {
  if (state.count === 0) return 'Delete Selected Forever';
  if (state.all) return `Delete All ${state.count} Forever`;
  return `Delete ${state.count} Forever`;
}

export function bulkDeleteConfirmText(state: SelectionState): string {
  const noun = state.count === 1 ? 'order' : 'orders';
  const scope = state.all ? ` — everything in the Recycle Bin${state.count > 1 ? ' that is shown' : ''}` : '';
  return `Permanently delete ${state.count} ${noun}${scope}? This cannot be undone.`;
}
