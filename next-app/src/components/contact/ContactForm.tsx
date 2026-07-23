'use client';

import { useRef, useState } from 'react';
import FormPrivacyNotice from '@/components/legal/FormPrivacyNotice';
import { FormGrid, PageContainer, Section } from '@/components/layout/ResponsiveLayout';

interface Props {
  locale: string;
  submitted: boolean;
}

export default function ContactForm({ locale, submitted }: Props) {
  const isEs = locale === 'es';
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [photoName, setPhotoName] = useState('');
  const [additionalNames, setAdditionalNames] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(submitted);
  const [err, setErr] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    setSending(true);
    setErr('');
    try {
      const fd = new FormData(formEl);
      fd.append('source', 'contact');
      const res = await fetch('/api/inquire', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await res.text());
      dialogRef.current?.close();
      setDone(true);
    } catch {
      setErr(isEs
        ? 'Error al enviar. Por favor inténtelo de nuevo.'
        : 'Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  }

  function openDialog(files: FileList | null) {
    if (!files || files.length === 0) return;
    setPhotoName(files[0].name);
    dialogRef.current?.showModal();
  }

  function handleAdditionalPhoto(slot: number, files: FileList | null) {
    if (!files || files.length === 0) return;
    setAdditionalNames((prev) => {
      const next = [...prev];
      next[slot] = files[0].name;
      return next;
    });
  }

  return (
    <Section
      id="submit-item"
      className="scroll-mt-28 border-b"
      style={{ background: 'var(--color-background)', borderColor: 'var(--color-outline-variant)' }}
      aria-labelledby="submit-item-heading"
    >
      <PageContainer max="content">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">

          {/* Form column */}
          <div className="lg:col-span-7">
            <span
              className="text-xs font-bold uppercase tracking-[0.4em]"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
            >
              {isEs ? 'Envío Rápido' : 'Quick Submission'}
            </span>
            <h2
              id="submit-item-heading"
              className="responsive-title-md font-bold mt-4 mb-8 tracking-tight"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
            >
              {isEs ? 'Envíe Su Artículo' : 'Submit Your Item'}
            </h2>

            {done ? (
              <div
                className="rounded-2xl border px-8 py-16 text-center shadow-[0_18px_54px_rgba(38,28,6,0.07)]"
                style={{ background: 'rgba(255,255,255,0.82)', borderColor: 'rgba(115, 92, 0, 0.14)' }}
              >
                <div
                  className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full text-xs font-bold uppercase tracking-[0.12em]"
                  style={{ background: '#f7efd7', color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                >
                  OK
                </div>
                <p
                  className="text-xl font-bold mb-2"
                  style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
                >
                  {isEs ? '¡Enviado!' : 'Submission received!'}
                </p>
                <p style={{ color: 'var(--color-on-surface-variant)' }}>
                  {isEs
                    ? 'Revisaremos sus fotos y nos comunicaremos con usted pronto.'
                    : "We'll review your photos and be in touch soon."}
                </p>
              </div>
            ) : (
              <form
                name="submit-item"
                onSubmit={handleSubmit}
                encType="multipart/form-data"
                className="grid gap-4 rounded-2xl border p-5 shadow-[0_18px_54px_rgba(38,28,6,0.07)] md:p-8"
                style={{ background: 'rgba(255,255,255,0.86)', borderColor: 'rgba(115, 92, 0, 0.14)' }}
              >
                <p className="sr-only" aria-hidden="true">
                  <label>
                    Do not fill this out if you are human:{' '}
                    <input name="bot-field" tabIndex={-1} autoComplete="off" />
                  </label>
                </p>

                {/* Photo drop zone */}
                <label
                  className="flex flex-col items-center justify-center rounded-2xl text-center cursor-pointer transition-colors"
                  style={{
                    minHeight: '16rem',
                    border: '1.5px dashed rgba(115, 92, 0, 0.22)',
                    background: '#fffdf8',
                    color: 'var(--color-on-surface-variant)',
                    padding: '1.5rem',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)';
                    (e.currentTarget as HTMLElement).style.background = '#fbf5e7';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(115, 92, 0, 0.22)';
                    (e.currentTarget as HTMLElement).style.background = '#fffdf8';
                  }}
                >
                  <input
                    id="item-photo-1"
                    type="file"
                    name="photo_1"
                    accept="image/*"
                    required
                    className="sr-only"
                    onChange={(e) => openDialog(e.target.files)}
                  />
                  <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#f7efd7]" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4.5 8.5h3l1.5-2h6l1.5 2h3A1.5 1.5 0 0 1 21 10v7a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17v-7a1.5 1.5 0 0 1 1.5-1.5Z" />
                      <circle cx="12" cy="13.5" r="3.2" />
                    </svg>
                  </span>
                  <span
                    className="text-xl md:text-2xl font-bold block"
                    style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-primary)' }}
                  >
                    {isEs ? 'Sube fotos de tu artículo' : 'Upload photos of your item'}
                  </span>
                  <span
                    className="block mt-3 text-sm leading-relaxed"
                    style={{ color: 'var(--color-on-surface-variant)' }}
                  >
                    {isEs
                      ? 'Comienza con una foto clara del artículo completo. Luego añade primeros planos de marcas o condición.'
                      : 'Start with a clear photo of the full item, then add closeups of hallmarks, stamps, or condition.'}
                  </span>
                  {photoName && (
                    <span className="block mt-3 text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                      {photoName}
                    </span>
                  )}
                </label>

                {/* Details modal */}
                <dialog
                  ref={dialogRef}
                  className="rounded-2xl p-0"
                  style={{
                    width: 'min(42rem, calc(100vw - 2rem))',
                    maxHeight: 'min(88vh, 48rem)',
                    overflow: 'auto',
                    border: '1px solid rgba(115, 92, 0, 0.16)',
                    background: 'rgba(255,255,255,0.96)',
                    color: 'var(--color-on-surface)',
                    boxShadow: '0 24px 80px rgba(0,0,0,0.26)',
                  }}
                >
                  <div className="grid gap-4 p-6 md:p-8">
                    {/* Modal header */}
                    <div
                      className="flex items-start justify-between gap-4 pb-4"
                      style={{ borderBottom: '1px solid var(--color-outline-variant)' }}
                    >
                      <div>
                        <span
                          className="text-xs font-bold uppercase tracking-[0.28em]"
                          style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                        >
                          {isEs ? 'Casi listo' : 'Almost done'}
                        </span>
                        <h3
                          className="text-2xl font-bold mt-2"
                          style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
                        >
                          {isEs ? 'Añade algunos detalles' : 'Add a few details'}
                        </h3>
                      </div>
                      <button
                        type="button"
                        aria-label={isEs ? 'Cerrar' : 'Close'}
                        onClick={() => dialogRef.current?.close()}
                        className="contact-form-dialog-close flex-shrink-0 rounded-full w-9 h-9 inline-grid place-items-center transition-colors"
                        style={{
                          border: '1px solid var(--color-outline-variant)',
                          color: 'var(--color-primary)',
                          background: 'transparent',
                        }}
                      >
                        <span aria-hidden="true">x</span>
                      </button>
                    </div>

                    {photoName && (
                      <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {isEs ? 'Foto seleccionada: ' : 'Photo selected: '}{photoName}
                      </p>
                    )}

                    {/* Additional photos */}
                    <div
                      className="grid gap-3 rounded-xl p-4"
                      style={{ border: '1px solid rgba(115, 92, 0, 0.14)', background: '#fffdf8' }}
                    >
                      <div>
                        <p
                          className="text-xs font-bold uppercase tracking-[0.14em]"
                          style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                        >
                          {isEs ? 'Fotos adicionales' : 'Additional photos'}
                        </p>
                        <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                          {isEs ? 'Opcional: añade hasta cuatro imágenes más.' : 'Optional: add up to four more images before sending.'}
                        </p>
                      </div>
                    <FormGrid>
                        {[2, 3, 4, 5].map((slot, i) => (
                          <label
                            key={slot}
                            className="flex items-center justify-center rounded-xl text-center cursor-pointer py-3 px-4 transition-colors"
                            style={{
                              minHeight: '3.25rem',
                              border: '1px dashed rgba(115, 92, 0, 0.24)',
                              background: 'rgba(255,255,255,0.72)',
                              color: 'var(--color-primary)',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              letterSpacing: '0.1em',
                              textTransform: 'uppercase',
                              fontFamily: 'var(--font-label)',
                            }}
                          >
                            <input
                              type="file"
                              name={`photo_${slot}`}
                              accept="image/*"
                              className="sr-only"
                              onChange={(e) => handleAdditionalPhoto(i, e.target.files)}
                            />
                            {additionalNames[i]
                              ? additionalNames[i]
                              : (isEs ? `Añadir foto ${slot}` : `Add photo ${slot}`)}
                          </label>
                        ))}
                    </FormGrid>
                    </div>

                    {/* Description */}
                    <div className="grid gap-1">
                      <label
                        htmlFor="item-description"
                        className="form-label"
                      >
                        {isEs ? '¿Qué desea enviar?' : 'What would you like to submit?'}
                      </label>
                      <textarea
                        id="item-description"
                        name="item_description"
                        required
                        placeholder={
                          isEs
                            ? 'Cuéntenos qué tiene, cualquier marca que vea y qué le gustaría saber.'
                            : 'Tell us what you have, any markings you see, and what you would like to know.'
                        }
                        className="form-field"
                        style={{ minHeight: '7rem', resize: 'vertical' }}
                      />
                    </div>

                    {/* Name + Phone */}
                    <FormGrid>
                      <div className="grid gap-1">
                        <label htmlFor="contact-name" className="form-label">
                          {isEs ? 'Su nombre' : 'Your name'} *
                        </label>
                        <input
                          id="contact-name"
                          name="name"
                          type="text"
                          autoComplete="name"
                          required
                          className="form-field"
                        />
                      </div>
                      <div className="grid gap-1">
                        <label htmlFor="contact-phone" className="form-label">
                          {isEs ? 'Número de teléfono' : 'Phone number'} *
                        </label>
                        <input
                          id="contact-phone"
                          name="phone"
                          type="tel"
                          autoComplete="tel"
                          required
                          className="form-field"
                        />
                      </div>
                    </FormGrid>

                    {/* Email + Location */}
                    <FormGrid>
                      <div className="grid gap-1">
                        <label htmlFor="contact-email" className="form-label">
                          {isEs ? 'Correo electrónico' : 'Email'}
                        </label>
                        <input
                          id="contact-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          className="form-field"
                        />
                      </div>
                      <div className="grid gap-1">
                        <label htmlFor="contact-location" className="form-label">
                          {isEs ? 'Ubicación' : 'Location'}
                        </label>
                        <input
                          id="contact-location"
                          name="location"
                          type="text"
                          autoComplete="address-level2"
                          placeholder="Naples, Fort Myers, Marco Island…"
                          className="form-field"
                        />
                      </div>
                    </FormGrid>

                    {/* Actions */}
                    <FormPrivacyNotice locale={locale} />

                    {err && (
                      <p className="text-sm" style={{ color: 'var(--color-error, #b91c1c)' }}>{err}</p>
                    )}

                    <div className="responsive-actions pt-1">
                      <button type="submit" className="gold-button" disabled={sending}>
                        {sending
                          ? (isEs ? 'Enviando…' : 'Sending…')
                          : (isEs ? 'Enviar artículo' : 'Send item')}
                      </button>
                      <label
                        htmlFor="item-photo-1"
                        className="outline-button cursor-pointer"
                        style={{
                          border: '1px solid var(--color-primary)',
                          color: 'var(--color-primary)',
                          fontFamily: 'var(--font-label)',
                        }}
                      >
                        {isEs ? 'Cambiar foto principal' : 'Change first photo'}
                      </label>
                    </div>
                  </div>
                </dialog>
              </form>
            )}
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-5 lg:sticky lg:top-28 space-y-4">
            {[
              {
                title: isEs ? '¿Prefiere hablar?' : 'Prefer to talk?',
                content: (
                  <>
                    <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {isEs
                        ? 'Respondemos llamadas y mensajes de texto en todo el suroeste de Florida, generalmente el mismo día.'
                        : 'We respond to calls and texts throughout Southwest Florida, usually the same day.'}
                    </p>
                    <a
                      href="tel:2394048505"
                      className="text-xl font-bold underline underline-offset-4"
                      style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-primary)', textDecorationColor: 'color-mix(in srgb, var(--color-primary) 30%, transparent)' }}
                    >
                      (239) 404-8505
                    </a>
                    <p className="mt-4">
                      <a
                        href="sms:+12394048505?&body=Hi%2C%20I%27d%20like%20a%20quick%20quote."
                        className="text-sm font-bold uppercase tracking-widest underline underline-offset-4"
                        style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                      >
                        {isEs ? 'O envíenos un texto' : 'Or text us directly'}
                      </a>
                    </p>
                  </>
                ),
              },
              {
                title: isEs ? 'Área de servicio' : 'Service area',
                content: (
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {isEs
                      ? 'Evaluaciones móviles, solo con cita, en Naples, Marco Island, Bonita Springs, Estero, Fort Myers, Cape Coral y comunidades cercanas.'
                      : 'Mobile, appointment-only evaluations in Naples, Marco Island, Bonita Springs, Estero, Fort Myers, Cape Coral, and nearby communities.'}
                  </p>
                ),
              },
              {
                title: isEs ? 'Programe una visita' : 'Schedule a visit',
                content: (
                  <>
                    <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {isEs
                        ? '¿Listo para una evaluación en persona? Reserve una consulta privada.'
                        : 'Ready for an in-person evaluation? Book a private consultation.'}
                    </p>
                    <a
                      href="tel:2394048505"
                      className="outline-button inline-flex"
                      style={{
                        border: '1px solid color-mix(in srgb, var(--color-primary) 60%, transparent)',
                        color: 'var(--color-primary)',
                        fontFamily: 'var(--font-label)',
                      }}
                    >
                      {isEs ? 'Programar Consulta' : 'Schedule Consultation'}
                    </a>
                  </>
                ),
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl p-6 shadow-[0_16px_44px_rgba(38,28,6,0.06)]"
                style={{ background: 'rgba(255,255,255,0.82)', border: '1px solid rgba(115, 92, 0, 0.14)' }}
              >
                <h3
                  className="font-bold mb-2"
                  style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
                >
                  {card.title}
                </h3>
                {card.content}
              </div>
            ))}
          </aside>

        </div>
      </PageContainer>
    </Section>
  );
}
