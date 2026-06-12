'use client';

import { useRef, useState } from 'react';

interface Props {
  locale: string;
  submitted: boolean;
}

export default function ContactForm({ locale, submitted }: Props) {
  const isEs = locale === 'es';
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [photoName, setPhotoName] = useState('');
  const [additionalNames, setAdditionalNames] = useState<string[]>([]);

  const action = locale === 'es'
    ? '/es/contact?submitted=1#submit-item'
    : '/contact?submitted=1#submit-item';

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
    <section
      id="submit-item"
      className="scroll-mt-28 py-16 md:py-24 border-b"
      style={{ background: 'var(--color-background)', borderColor: 'var(--color-outline-variant)' }}
      aria-labelledby="submit-item-heading"
    >
      <div className="container mx-auto px-6 md:px-8 max-w-6xl">
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
              className="text-3xl md:text-4xl font-bold mt-4 mb-8 tracking-tight"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
            >
              {isEs ? 'Envíe Su Artículo' : 'Submit Your Item'}
            </h2>

            {submitted ? (
              <div
                className="text-center py-16 px-8 rounded-sm border"
                style={{ background: 'var(--color-surface-container-low)', borderColor: 'var(--color-outline-variant)' }}
              >
                <div className="text-5xl mb-4">✓</div>
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
                method="POST"
                action={action}
                data-netlify="true"
                data-netlify-honeypot="bot-field"
                encType="multipart/form-data"
                className="grid gap-4 p-6 md:p-8 rounded-sm border"
                style={{ background: 'white', borderColor: 'var(--color-outline-variant)' }}
              >
                <input type="hidden" name="form-name" value="submit-item" />
                <p className="sr-only">
                  <label>
                    Do not fill this out if you are human: <input name="bot-field" />
                  </label>
                </p>

                {/* Photo drop zone */}
                <label
                  className="flex flex-col items-center justify-center text-center cursor-pointer rounded-sm transition-colors"
                  style={{
                    minHeight: '16rem',
                    border: '1.5px dashed var(--color-outline-variant)',
                    background: '#fbfaf6',
                    color: 'var(--color-on-surface-variant)',
                    padding: '1.5rem',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)';
                    (e.currentTarget as HTMLElement).style.background = '#f8f3e5';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-outline-variant)';
                    (e.currentTarget as HTMLElement).style.background = '#fbfaf6';
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
                  <span className="text-5xl mb-3" aria-hidden="true">📷</span>
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
                  className="rounded-sm p-0"
                  style={{
                    width: 'min(42rem, calc(100vw - 2rem))',
                    maxHeight: 'min(88vh, 48rem)',
                    overflow: 'auto',
                    border: '1px solid var(--color-outline-variant)',
                    background: 'white',
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
                        className="flex-shrink-0 rounded-full w-9 h-9 inline-grid place-items-center transition-colors"
                        style={{
                          border: '1px solid var(--color-outline-variant)',
                          color: 'var(--color-primary)',
                          background: 'transparent',
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    {photoName && (
                      <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {isEs ? 'Foto seleccionada: ' : 'Photo selected: '}{photoName}
                      </p>
                    )}

                    {/* Additional photos */}
                    <div
                      className="grid gap-3 rounded-sm p-4"
                      style={{ border: '1px solid var(--color-outline-variant)', background: '#fbfaf6' }}
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
                      <div className="grid sm:grid-cols-2 gap-3">
                        {[2, 3, 4, 5].map((slot, i) => (
                          <label
                            key={slot}
                            className="flex items-center justify-center text-center cursor-pointer rounded-sm py-3 px-4 transition-colors"
                            style={{
                              minHeight: '3.25rem',
                              border: '1px dashed var(--color-outline-variant)',
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
                      </div>
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
                    <div className="grid sm:grid-cols-2 gap-4">
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
                    </div>

                    {/* Email + Location */}
                    <div className="grid sm:grid-cols-2 gap-4">
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
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3 items-center pt-1">
                      <button type="submit" className="gold-button">
                        {isEs ? 'Enviar artículo' : 'Send item'}
                      </button>
                      <label
                        htmlFor="item-photo-1"
                        className="cursor-pointer text-xs font-bold uppercase tracking-[0.12em] px-5 py-3 rounded-sm transition-colors"
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
                      className="inline-block text-xs font-bold uppercase tracking-widest px-6 py-3 rounded-sm transition-colors"
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
                className="rounded-sm p-6"
                style={{ background: 'white', border: '1px solid var(--color-outline-variant)' }}
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
      </div>
    </section>
  );
}
