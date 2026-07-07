'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
}

export default function ComboboxInput({ value, onChange, options, placeholder, id, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = value.trim()
    ? options.filter(opt => opt.toLowerCase().includes(value.toLowerCase()))
    : options;

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, []);

  function focusInput() {
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex' }}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          className="form-field"
          disabled={disabled}
          style={{
            flex: 1,
            borderRight: 'none',
            borderRadius: '2px 0 0 2px',
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
            ...(disabled ? { background: 'var(--color-surface-container-low)', color: 'var(--color-on-surface-variant)' } : {}),
          }}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => { if (!disabled) setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Enter') setOpen(false);
          }}
          autoComplete="off"
        />
        <button
          type="button"
          // A value present always shows a clear ("x") button — clicking it wipes the
          // field in a single click, immediately, so the admin can type a brand-new
          // custom entry into a truly blank box. When empty, it's just the
          // open/close toggle for the suggestion list.
          aria-label={value ? 'Clear field' : open ? 'Close options' : 'Show options'}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (disabled) return;
            if (value) {
              onChange('');
              setOpen(true);
              focusInput();
              return;
            }
            setOpen((prev) => !prev);
            focusInput();
          }}
          style={{
            width: '2.25rem',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--color-outline-variant)',
            borderLeft: 'none',
            borderRadius: '0 2px 2px 0',
            background: value ? 'var(--color-surface-container-lowest)' : 'var(--color-surface-container-low)',
            color: 'var(--color-on-surface-variant)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: value ? '0.85rem' : '0.7rem',
            fontWeight: value ? 800 : 400,
            transition: 'background 0.12s, color 0.12s',
          }}
        >
          {value ? 'x' : (
            <span style={{
              display: 'inline-block',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s',
              lineHeight: 1,
            }}>v</span>
          )}
        </button>
      </div>

      {open && (
        <ul
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 200,
            maxHeight: '14rem',
            overflowY: 'auto',
            margin: 0,
            padding: 0,
            listStyle: 'none',
            border: '1px solid var(--color-outline-variant)',
            borderTop: 'none',
            background: 'white',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}
        >
          {filtered.length === 0 && (
            <li style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: 'var(--color-on-surface-variant)', fontStyle: 'italic' }}>
              No matches
            </li>
          )}
          {filtered.map((opt) => (
            <li
              key={opt}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt);
                setOpen(false);
              }}
              style={{
                padding: '0.45rem 0.75rem',
                fontSize: '0.875rem',
                cursor: 'pointer',
                color: opt === value ? 'var(--color-primary)' : 'var(--color-on-surface)',
                fontWeight: opt === value ? 700 : 400,
                background: 'transparent',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLLIElement).style.background = 'var(--color-surface-container-low)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLLIElement).style.background = 'transparent'; }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
