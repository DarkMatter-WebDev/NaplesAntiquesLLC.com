'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export default function UnsubscribeForm({ locale, initialEmail = '', token = '' }: { locale: string; initialEmail?: string; token?: string }) {
  const isEs = locale === 'es';
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const autoSubmitted = useRef(false);

  const submitPreference = useCallback(async (nextEmail: string, nextToken = token) => {
    setStatus('saving');
    setMessage('');

    const res = await fetch('/api/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: nextEmail, token: nextToken }),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
      setStatus('error');
      setMessage(data?.error ?? (isEs ? 'No se pudo actualizar.' : 'Could not update subscription.'));
      return;
    }

    setStatus('success');
    setMessage(isEs ? 'Su preferencia fue actualizada.' : 'Your email preference has been updated.');
    if (!nextToken) setEmail('');
  }, [isEs, token]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitPreference(email);
  }

  useEffect(() => {
    if (!token || autoSubmitted.current) return;
    autoSubmitted.current = true;
    void submitPreference(email, token);
  }, [email, submitPreference, token]);

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 grid gap-4 border p-5"
      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
    >
      <label>
        <span className="form-label">{isEs ? 'Correo electronico' : 'Email Address'}</span>
        <input
          type="email"
          required={!token}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="form-field w-full"
          autoComplete="email"
        />
      </label>
      {message && (
        <p className="text-sm" style={{ color: status === 'error' ? 'var(--color-error)' : 'var(--color-primary)' }}>
          {message}
        </p>
      )}
      <button type="submit" disabled={status === 'saving'} className="gold-button w-fit disabled:opacity-60">
        {status === 'saving' ? (isEs ? 'Actualizando...' : 'Updating...') : (isEs ? 'Cancelar suscripcion' : 'Unsubscribe')}
      </button>
    </form>
  );
}
