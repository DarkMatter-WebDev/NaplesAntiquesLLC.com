'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export interface EtsyCategoryLeaf {
  id: number;
  path: string;
}

interface Props {
  leaves: EtsyCategoryLeaf[];
  /** The currently selected full path, if any — highlighted in the list. */
  selectedPath: string | null;
  onSelect: (leaf: EtsyCategoryLeaf) => void;
  onCancel: () => void;
  disabled?: boolean;
}

const JEWELRY_PREFIX = 'Jewelry > ';
const SUPPLY_PREFIX = 'Craft Supplies & Tools > ';
const MAX_SEARCH_RESULTS = 80;

interface Group {
  key: string;
  label: string;
  supply: boolean;
  leaves: EtsyCategoryLeaf[];
}

function leafName(path: string): string {
  const parts = path.split(' > ');
  return parts[parts.length - 1] ?? path;
}

function parentPath(path: string): string {
  const parts = path.split(' > ');
  return parts.slice(0, -1).join(' › ');
}

/**
 * Group leaves by their parent path, in first-seen order, so results read as
 * "Jewelry · Necklaces" blocks rather than one long list of full paths.
 * Craft-supply groups are labelled as such: Etsy's search box hides the
 * parent path, which is how a finished pendant nearly landed under
 * "Craft Supplies & Tools > … > Charms & Pendants > Pendants" (2026-09-12).
 */
function groupLeaves(leaves: EtsyCategoryLeaf[]): Group[] {
  const groups = new Map<string, Group>();
  for (const leaf of leaves) {
    const parent = parentPath(leaf.path);
    const supply = leaf.path.startsWith(SUPPLY_PREFIX);
    let group = groups.get(parent);
    if (!group) {
      group = {
        key: parent,
        label: supply ? `${parent} — jewelry-making supplies, not finished jewelry` : parent,
        supply,
        leaves: [],
      };
      groups.set(parent, group);
    }
    group.leaves.push(leaf);
  }
  return Array.from(groups.values());
}

/**
 * The Etsy category picker used by the marketplace review window: Jewelry's
 * own branches when the search is empty, every seller category when typing,
 * and the parent path always visible next to the leaf name.
 */
export default function EtsyCategoryDropdown({ leaves, selectedPath, onSelect, onCancel, disabled = false }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      // Jewelry first (the catalog), then everything else is a search away.
      const jewelry = leaves.filter((leaf) => leaf.path.startsWith(JEWELRY_PREFIX));
      return groupLeaves(jewelry);
    }
    const words = needle.split(/\s+/).filter(Boolean);
    const matches = leaves.filter((leaf) => {
      const haystack = leaf.path.toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
    // Leaf-name hits before parent-path hits, jewelry before supplies, so
    // "pend" puts Pendant Necklaces above Pendant Lights and the supply leaves.
    const ranked = matches
      .map((leaf) => {
        const name = leafName(leaf.path).toLowerCase();
        const nameHit = words.every((word) => name.includes(word)) ? 0 : 1;
        const jewelry = leaf.path.startsWith(JEWELRY_PREFIX) ? 0 : 1;
        const supply = leaf.path.startsWith(SUPPLY_PREFIX) ? 1 : 0;
        return { leaf, rank: nameHit * 4 + supply * 2 + jewelry };
      })
      .sort((a, b) => a.rank - b.rank)
      .slice(0, MAX_SEARCH_RESULTS)
      .map((entry) => entry.leaf);
    return groupLeaves(ranked);
  }, [leaves, query]);

  const total = groups.reduce((sum, group) => sum + group.leaves.length, 0);

  return (
    <div
      className="mt-2 flex flex-col gap-2 border p-3"
      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Search all ${leaves.length.toLocaleString('en-US')} Etsy categories…`}
        className="form-field w-full"
        disabled={disabled}
        aria-label="Search Etsy categories"
        autoComplete="off"
      />
      <p className="text-[0.65rem]" style={{ color: 'var(--color-on-surface-variant)' }}>
        {query.trim()
          ? total === 0
            ? 'No category matches that.'
            : `${total} match${total === 1 ? '' : 'es'}${total >= MAX_SEARCH_RESULTS ? ' (showing the closest)' : ''}`
          : 'Jewelry categories, grouped the way Etsy groups them. Type to search every category.'}
      </p>
      <ul
        className="m-0 max-h-72 list-none overflow-y-auto border p-0"
        style={{ borderColor: 'var(--color-outline-variant)', background: 'white' }}
        role="listbox"
        aria-label="Etsy categories"
      >
        {groups.map((group) => (
          <li key={group.key}>
            <p
              className="sticky top-0 m-0 px-3 pb-1 pt-2 text-[0.6rem] font-extrabold uppercase tracking-[0.12em]"
              style={{
                background: 'var(--color-surface-container-low)',
                color: group.supply ? '#8a6400' : 'var(--color-on-surface-variant)',
              }}
            >
              {group.label}
            </p>
            <ul className="m-0 list-none p-0">
              {group.leaves.map((leaf) => {
                const selected = leaf.path === selectedPath;
                return (
                  <li
                    key={leaf.id}
                    role="option"
                    aria-selected={selected}
                    tabIndex={0}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      if (!disabled) onSelect(leaf);
                    }}
                    onKeyDown={(event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && !disabled) {
                        event.preventDefault();
                        onSelect(leaf);
                      }
                    }}
                    className="flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1.5 text-[0.82rem] hover:bg-[var(--color-surface-container-low)] focus-visible:bg-[var(--color-surface-container-low)] focus-visible:outline-none"
                    style={{
                      color: selected ? 'var(--color-primary)' : group.supply ? 'var(--color-on-surface-variant)' : 'var(--color-on-surface)',
                      fontWeight: selected ? 700 : 400,
                    }}
                  >
                    <span>{leafName(leaf.path)}</span>
                    <span className="shrink-0 text-[0.65rem]" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {parentPath(leaf.path)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
      <div className="flex justify-end">
        <button type="button" onClick={onCancel} disabled={disabled} className="outline-button text-xs">
          Cancel
        </button>
      </div>
    </div>
  );
}
