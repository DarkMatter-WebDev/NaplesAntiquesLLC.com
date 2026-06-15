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

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl"
      style={{
        color: '#f9f9f7',
        fontFamily: 'var(--font-label)',
      }}
    >
      <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.24em]" style={{ color: GOLD }}>
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
          className="h-11 min-w-0 border bg-white/10 px-3 text-sm outline-none placeholder:text-white/55"
          style={{ borderColor: 'rgba(233,195,73,0.45)', color: '#fff' }}
        />
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={isEs ? 'Correo electronico' : 'Email address'}
          className="h-11 min-w-0 border bg-white/10 px-3 text-sm outline-none placeholder:text-white/55"
          style={{ borderColor: 'rgba(233,195,73,0.45)', color: '#fff' }}
        />
        <button
          type="submit"
          disabled={status === 'saving'}
          className="h-11 px-5 text-xs font-bold uppercase tracking-widest disabled:opacity-60"
          style={{ background: GOLD, color: '#171717' }}
        >
          {status === 'saving' ? (isEs ? 'Enviando' : 'Joining') : (isEs ? 'Unirse' : 'Join')}
        </button>
      </div>
      {message && (
        <p className="mt-2 text-xs" style={{ color: status === 'error' ? '#ffdfdf' : '#f9f9f7' }}>
          {message}
        </p>
      )}
    </form>
  );
}
