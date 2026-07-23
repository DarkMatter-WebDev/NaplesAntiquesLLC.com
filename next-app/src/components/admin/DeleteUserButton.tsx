'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';

interface Props {
  userId: string;
  userName: string;
  userEmail: string | null;
  isAdmin: boolean;
}

export default function DeleteUserButton({ userId, userName, userEmail, isAdmin }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  function openModal() {
    setError('');
    setOpen(true);
  }

  function closeModal() {
    if (!deleting) setOpen(false);
  }

  async function handleDelete() {
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to delete account');
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="outline-button text-xs"
        style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
      >
        Delete
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-user-title"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto whitespace-normal p-4 sm:items-center"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="min-w-0 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl [overflow-wrap:anywhere] sm:p-6">
            {/* Icon */}
            <div
              className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full"
              style={{ background: '#fef2f2' }}
            >
              <span className="material-symbols-outlined" aria-hidden="true" style={{ color: '#b91c1c', fontSize: '1.5rem' }}>
                warning
              </span>
            </div>

            <h2
              id="delete-user-title"
              className="text-center text-xl font-bold mb-1"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
            >
              Delete Account
            </h2>
            <p className="text-center text-sm mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>
              You are about to permanently delete:
            </p>
            <p className="min-w-0 text-center font-semibold mb-5 [overflow-wrap:anywhere]" style={{ color: 'var(--color-on-surface)' }}>
              {userName}{userEmail ? ` · ${userEmail}` : ''}
            </p>

            {isAdmin && (
              <div
                className="mb-4 rounded-lg border px-4 py-3 text-sm text-center font-semibold"
                style={{ borderColor: '#fed7aa', background: '#fff7ed', color: '#c2410c' }}
              >
                This user is an admin account.
              </div>
            )}

            <div
              className="mb-5 min-w-0 whitespace-normal rounded-lg border px-4 py-3 text-sm leading-relaxed [overflow-wrap:anywhere]"
              style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}
            >
              This action is <strong>permanent and cannot be undone.</strong> The login credentials, profile data, and all associated records will be immediately and irreversibly deleted.
            </div>

            {error && (
              <p className="mb-4 text-center text-sm font-semibold" style={{ color: '#b91c1c' }}>
                {error}
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={deleting}
                className="w-full justify-center outline-button"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-bold text-white transition-opacity"
                style={{ background: '#b91c1c', opacity: deleting ? 0.6 : 1, cursor: deleting ? 'not-allowed' : 'pointer' }}
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
