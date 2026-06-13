'use client';

import { useState } from 'react';

interface Props {
  locale: string;
  submitted: boolean;
}

export default function EvalForm({ locale, submitted }: Props) {
  const isEs = locale === 'es';
  const [photoCount, setPhotoCount] = useState(0);

  const action = locale === 'es'
    ? '/es/free-evaluation?submitted=1'
    : '/free-evaluation?submitted=1';

  return (
    <form
      id="fe-eval-form"
      name="free-evaluation-request"
      method="POST"
      action={action}
      data-netlify="true"
      data-netlify-honeypot="bot-field"
      encType="multipart/form-data"
      className="rounded-sm p-6 grid gap-4"
      style={{
        background: 'rgba(255,255,255,0.97)',
        maxWidth: 540,
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      }}
    >
      <input type="hidden" name="form-name" value="free-evaluation-request" />
      <p className="sr-only">
        <label>Do not fill this out if you are human: <input name="bot-field" /></label>
      </p>

      {submitted ? (
        <div className="text-center py-8 px-4">
          <div className="text-4xl mb-4">✓</div>
          <p
            className="text-lg font-bold mb-2"
            style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
          >
            {isEs ? '¡Enviado!' : 'Submission received!'}
          </p>
          <p className="text-sm" style={{ color: '#5e5e5d' }}>
            {isEs
              ? 'Revisaremos sus fotos y nos comunicaremos con usted pronto.'
              : "We'll review your photos and be in touch soon."}
          </p>
        </div>
      ) : (
        <>
          {/* Photo upload */}
          <div className="grid gap-1">
            <span
              className="text-[0.7rem] font-bold uppercase tracking-[0.14em]"
              style={{ color: '#5e5e5d', fontFamily: 'var(--font-label)' }}
            >
              {isEs ? 'Fotos — seleccione una o más' : 'Photos — select one or more'}
            </span>
            <label
              className="flex flex-col items-center justify-center text-center cursor-pointer rounded-sm transition-colors"
              style={{
                minHeight: '10rem',
                border: '1.5px dashed #b9a982',
                background: '#fbfaf6',
                color: '#735c00',
                padding: '1.5rem',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = '#735c00';
                (e.currentTarget as HTMLElement).style.background = '#f8f3e5';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = '#b9a982';
                (e.currentTarget as HTMLElement).style.background = '#fbfaf6';
              }}
            >
              <input
                id="fe-photos"
                type="file"
                name="photos"
                accept="image/*"
                multiple
                required
                className="sr-only"
                onChange={(e) => setPhotoCount(e.target.files?.length ?? 0)}
              />
              <span className="text-4xl block mb-2" aria-hidden="true">📷</span>
              <span className="text-base font-bold block">
                {isEs ? 'Toca para añadir fotos' : 'Tap to add photos'}
              </span>
              <span className="text-sm block mt-1" style={{ color: '#7a7060' }}>
                {isEs
                  ? 'Selecciona varias a la vez desde tu rollo de cámara o archivos'
                  : 'Select multiple at once from your camera roll or files'}
              </span>
              {photoCount > 0 && (
                <span className="text-sm font-semibold block mt-2" style={{ color: '#735c00' }}>
                  {photoCount} {isEs ? (photoCount === 1 ? 'foto seleccionada' : 'fotos seleccionadas') : (photoCount === 1 ? 'photo selected' : 'photos selected')}
                </span>
              )}
            </label>
          </div>

          {/* Description */}
          <div className="grid gap-1">
            <label
              htmlFor="fe-description"
              className="text-[0.7rem] font-bold uppercase tracking-[0.14em]"
              style={{ color: '#5e5e5d', fontFamily: 'var(--font-label)' }}
            >
              {isEs ? '¿Qué está enviando?' : 'What are you submitting?'}
            </label>
            <textarea
              id="fe-description"
              name="description"
              rows={2}
              placeholder={isEs
                ? 'Cadena de oro, anillo de diamante, colección de monedas — cualquier detalle ayuda.'
                : 'Gold chain, diamond ring, coin collection — any details help.'}
              className="w-full rounded-sm text-sm px-3 py-2"
              style={{
                border: '1px solid #d8d0c2',
                background: 'white',
                color: '#1a1c1c',
                minHeight: '4.5rem',
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </div>

          {/* Name + Phone */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <label
                htmlFor="fe-name"
                className="text-[0.7rem] font-bold uppercase tracking-[0.14em]"
                style={{ color: '#5e5e5d', fontFamily: 'var(--font-label)' }}
              >
                {isEs ? 'Su nombre' : 'Your name'} *
              </label>
              <input
                id="fe-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                className="w-full rounded-sm text-sm px-3 py-2"
                style={{ border: '1px solid #d8d0c2', background: 'white', color: '#1a1c1c' }}
              />
            </div>
            <div className="grid gap-1">
              <label
                htmlFor="fe-phone"
                className="text-[0.7rem] font-bold uppercase tracking-[0.14em]"
                style={{ color: '#5e5e5d', fontFamily: 'var(--font-label)' }}
              >
                {isEs ? 'Teléfono' : 'Phone'} *
              </label>
              <input
                id="fe-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                className="w-full rounded-sm text-sm px-3 py-2"
                style={{ border: '1px solid #d8d0c2', background: 'white', color: '#1a1c1c' }}
              />
            </div>
          </div>

          {/* Email */}
          <div className="grid gap-1">
            <label
              htmlFor="fe-email"
              className="text-[0.7rem] font-bold uppercase tracking-[0.14em]"
              style={{ color: '#5e5e5d', fontFamily: 'var(--font-label)' }}
            >
              {isEs ? 'Correo electrónico' : 'Email'}
            </label>
            <input
              id="fe-email"
              name="email"
              type="email"
              autoComplete="email"
              className="w-full rounded-sm text-sm px-3 py-2"
              style={{ border: '1px solid #d8d0c2', background: 'white', color: '#1a1c1c' }}
            />
          </div>

          <button type="submit" className="gold-button w-full">
            {isEs ? 'Enviar para Evaluación Gratuita' : 'Send for Free Evaluation'}
          </button>
        </>
      )}
    </form>
  );
}
