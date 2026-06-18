'use client';

import { useState } from 'react';

const GOLD = '#e9c349';

export default function HomeSubscriberForm({ locale }: { locale: string }) {
  const isEs = locale === 'es';
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('saving');
    setMessage('');

    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, fullName, locale }),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
      setStatus('error');
      setMessage(data?.error ?? (isEs ? 'No se pudo guardar.' : 'Could not save.'));
      return;
    }

    setStatus('success');
    setMessage(isEs ? 'Gracias. Ya esta en la lista.' : "You're on the list.");
    setEmail('');
    setFullName('');
  }

  // Inputs use a solid light fill with dark text so they're clearly legible
  // over both the white and black hero backgrounds the carousel sweeps through.
  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.96)',
    borderColor: GOLD,
    color: '#1a1a1a',
    boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl"
      style={{
        color: 'var(--hero-text)',
        fontFamily: 'var(--font-label)',
      }}
    >
      <p
        className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.24em]"
        style={{ color: 'var(--hero-eyebrow)', textShadow: '0 1px 10px rgba(var(--hero-fade), 0.9)' }}
      >
        {isEs ? 'Reciba nuevas piezas primero' : 'Get first look at new pieces'}
      </p>
      <div
        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_auto]"
        style={{ alignItems: 'stretch' }}
      >
        <input
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder={isEs ? 'Nombre' : 'Name'}
          className="h-11 min-w-0 border px-3 text-sm outline-none placeholder:text-black/50"
          style={inputStyle}
        />
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={isEs ? 'Correo electronico' : 'Email address'}
          className="h-11 min-w-0 border px-3 text-sm outline-none placeholder:text-black/50"
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={status === 'saving'}
          className="h-11 px-5 text-xs font-bold uppercase tracking-widest disabled:opacity-60"
          style={{ background: GOLD, color: '#171717', boxShadow: '0 2px 10px rgba(0,0,0,0.18)' }}
        >
          {status === 'saving' ? (isEs ? 'Enviando' : 'Joining') : (isEs ? 'Unirse' : 'Join')}
        </button>
      </div>
      {message && (
        <p
          className="mt-2 text-xs"
          style={{ color: status === 'error' ? '#d33' : 'var(--hero-text)', textShadow: '0 1px 10px rgba(var(--hero-fade), 0.9)' }}
        >
          {message}
        </p>
      )}
    </form>
  );
}
