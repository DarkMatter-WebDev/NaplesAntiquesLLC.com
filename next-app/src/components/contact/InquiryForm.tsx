'use client';

import { useState } from 'react';

interface Props {
  locale: string;
  itemName: string;
  submitted: boolean;
}

export default function InquiryForm({ locale, itemName, submitted: initialSubmitted }: Props) {
  const isEs = locale === 'es';
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(
    isEs ? `Estoy interesado/a en: ${itemName}. ` : `I'm interested in: ${itemName}. `
  );
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(initialSubmitted);
  const [err, setErr] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setErr('');
    try {
      const res = await fetch('/api/inquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: itemName, name, phone, email, message }),
      });
      if (!res.ok) throw new Error(await res.text());
      setDone(true);
    } catch {
      setErr(isEs
        ? 'Error al enviar. Por favor inténtelo de nuevo.'
        : 'Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <section className="py-16 md:py-24" style={{ background: 'var(--color-background)' }}>
        <div className="container mx-auto px-6 md:px-8 max-w-2xl text-center">
          <div className="text-5xl mb-4">✓</div>
          <p
            className="text-2xl font-bold mb-3"
            style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
          >
            {isEs ? '¡Mensaje enviado!' : 'Message sent!'}
          </p>
          <p style={{ color: 'var(--color-on-surface-variant)' }}>
            {isEs
              ? 'Revisaremos su consulta y nos comunicaremos pronto.'
              : "We'll review your inquiry and be in touch soon."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 md:py-24" style={{ background: 'var(--color-background)' }}>
      <div className="container mx-auto px-6 md:px-8 max-w-3xl">

        <div
          className="mb-8 p-4 rounded-sm text-sm"
          style={{
            background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)',
            color: 'var(--color-on-surface)',
          }}
        >
          <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>
            {isEs ? 'Artículo: ' : 'Item: '}
          </span>
          {itemName}
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-5 p-6 md:p-8 rounded-sm border"
          style={{ background: 'white', borderColor: 'var(--color-outline-variant)' }}
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-1">
              <label htmlFor="inq-name" className="form-label">
                {isEs ? 'Su nombre' : 'Your name'} *
              </label>
              <input
                id="inq-name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-field"
              />
            </div>
            <div className="grid gap-1">
              <label htmlFor="inq-phone" className="form-label">
                {isEs ? 'Teléfono' : 'Phone'} *
              </label>
              <input
                id="inq-phone"
                type="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="form-field"
              />
            </div>
          </div>

          <div className="grid gap-1">
            <label htmlFor="inq-email" className="form-label">
              {isEs ? 'Correo electrónico' : 'Email'}
            </label>
            <input
              id="inq-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-field"
            />
          </div>

          <div className="grid gap-1">
            <label htmlFor="inq-message" className="form-label">
              {isEs ? 'Mensaje' : 'Message'} *
            </label>
            <textarea
              id="inq-message"
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="form-field"
              style={{ minHeight: '7rem', resize: 'vertical' }}
            />
          </div>

          {err && (
            <p className="text-sm" style={{ color: 'var(--color-error, #b91c1c)' }}>{err}</p>
          )}

          <div className="flex gap-3 items-center pt-1">
            <button type="submit" className="gold-button" disabled={sending}>
              {sending
                ? (isEs ? 'Enviando…' : 'Sending…')
                : (isEs ? 'Enviar consulta' : 'Send inquiry')}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
