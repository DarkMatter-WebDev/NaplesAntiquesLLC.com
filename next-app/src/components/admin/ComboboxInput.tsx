'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  id?: string;
}

export default function ComboboxInput({ value, onChange, options, placeholder, id }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex' }}>
        <input
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          className="form-field"
          style={{ flex: 1, borderRight: 'none', borderRadius: '2px 0 0 2px', borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Enter') setOpen(false);
          }}
          autoComplete="off"
        />
        <button
          type="button"
          aria-label={open ? 'Close options' : 'Show options'}
          onClick={() => setOpen(o => !o)}
          style={{
            width: '2.25rem',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--color-outline-variant)',
            borderLeft: 'none',
            borderRadius: '0 2px 2px 0',
            background: 'var(--color-surface-container-low)',
            color: 'var(--color-on-surface-variant)',
            cursor: 'pointer',
            fontSize: '0.7rem',
            transition: 'background 0.12s',
          }}
        >
          <span style={{
            display: 'inline-block',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
            lineHeight: 1,
          }}>▾</span>
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
                e.preventDefault(); // prevent input blur before click registers
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
