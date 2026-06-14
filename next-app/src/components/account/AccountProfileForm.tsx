'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const GOLD = '#735c00';
const BORDER = 'var(--color-outline-variant)';

export interface CustomerProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  alternate_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  marketing_opt_in: boolean | null;
}

type ProfileFormState = {
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  alternate_phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  marketing_opt_in: boolean;
};

function valueOrEmpty(value: string | null | undefined) {
  return value ?? '';
}

function buildInitialState(profile: CustomerProfile, fallbackEmail: string | null): ProfileFormState {
  return {
    first_name: valueOrEmpty(profile.first_name),
    last_name: valueOrEmpty(profile.last_name),
    full_name: valueOrEmpty(profile.full_name),
    email: valueOrEmpty(profile.email || fallbackEmail),
    phone: valueOrEmpty(profile.phone),
    alternate_phone: valueOrEmpty(profile.alternate_phone),
    address_line1: valueOrEmpty(profile.address_line1),
    address_line2: valueOrEmpty(profile.address_line2),
    city: valueOrEmpty(profile.city),
    state: valueOrEmpty(profile.state),
    postal_code: valueOrEmpty(profile.postal_code),
    country: valueOrEmpty(profile.country || 'United States'),
    marketing_opt_in: profile.marketing_opt_in === true,
  };
}

export default function AccountProfileForm({
  profile,
  fallbackEmail,
  locale,
}: {
  profile: CustomerProfile;
  fallbackEmail: string | null;
  locale: string;
}) {
  const isEs = locale === 'es';
  const [form, setForm] = useState<ProfileFormState>(() => buildInitialState(profile, fallbackEmail));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateField(key: keyof ProfileFormState, value: string | boolean) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'first_name' || key === 'last_name') {
        const fullName = `${key === 'first_name' ? value : next.first_name} ${key === 'last_name' ? value : next.last_name}`.trim();
        next.full_name = fullName;
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    const supabase = createClient();
    const payload = {
      id: profile.id,
      first_name: form.first_name.trim() || null,
      last_name: form.last_name.trim() || null,
      full_name: form.full_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      alternate_phone: form.alternate_phone.trim() || null,
      address_line1: form.address_line1.trim() || null,
      address_line2: form.address_line2.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      postal_code: form.postal_code.trim() || null,
      country: form.country.trim() || 'United States',
      marketing_opt_in: form.marketing_opt_in,
    };

    const { error: saveError } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' });

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    setMessage(isEs ? 'Perfil guardado.' : 'Profile saved.');
    setSaving(false);
  }

  const inputStyle = 'form-field w-full';

  return (
    <form onSubmit={handleSubmit} className="border p-5 md:p-6 mb-6" style={{ borderColor: BORDER, background: 'var(--color-surface-container-lowest)' }}>
      <div className="flex flex-col gap-1 mb-5">
        <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
          {isEs ? 'Perfil completo' : 'Complete Profile'}
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs
            ? 'Guarde su informacion de contacto y direccion para acelerar el checkout.'
            : 'Save your contact and address information to speed up checkout.'}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <label>
          <span className="form-label">{isEs ? 'Nombre' : 'First Name'}</span>
          <input className={inputStyle} autoComplete="given-name" value={form.first_name} onChange={(e) => updateField('first_name', e.target.value)} />
        </label>
        <label>
          <span className="form-label">{isEs ? 'Apellido' : 'Last Name'}</span>
          <input className={inputStyle} autoComplete="family-name" value={form.last_name} onChange={(e) => updateField('last_name', e.target.value)} />
        </label>
        <label>
          <span className="form-label">{isEs ? 'Correo de contacto' : 'Contact Email'}</span>
          <input className={inputStyle} type="email" autoComplete="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
        </label>
        <label>
          <span className="form-label">{isEs ? 'Telefono' : 'Phone'}</span>
          <input className={inputStyle} type="tel" autoComplete="tel" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
        </label>
        <label>
          <span className="form-label">{isEs ? 'Telefono alternativo' : 'Alternate Phone'}</span>
          <input className={inputStyle} type="tel" autoComplete="tel" value={form.alternate_phone} onChange={(e) => updateField('alternate_phone', e.target.value)} />
        </label>
      </div>

      <div className="mt-6 mb-3">
        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
          {isEs ? 'Direccion' : 'Address'}
        </h3>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="sm:col-span-2">
          <span className="form-label">{isEs ? 'Direccion linea 1' : 'Address Line 1'}</span>
          <input className={inputStyle} autoComplete="address-line1" value={form.address_line1} onChange={(e) => updateField('address_line1', e.target.value)} />
        </label>
        <label className="sm:col-span-2">
          <span className="form-label">{isEs ? 'Direccion linea 2' : 'Address Line 2'}</span>
          <input className={inputStyle} autoComplete="address-line2" value={form.address_line2} onChange={(e) => updateField('address_line2', e.target.value)} />
        </label>
        <label>
          <span className="form-label">{isEs ? 'Ciudad' : 'City'}</span>
          <input className={inputStyle} autoComplete="address-level2" value={form.city} onChange={(e) => updateField('city', e.target.value)} />
        </label>
        <label>
          <span className="form-label">{isEs ? 'Estado' : 'State'}</span>
          <input className={inputStyle} autoComplete="address-level1" value={form.state} onChange={(e) => updateField('state', e.target.value)} />
        </label>
        <label>
          <span className="form-label">{isEs ? 'Codigo postal' : 'ZIP / Postal Code'}</span>
          <input className={inputStyle} autoComplete="postal-code" value={form.postal_code} onChange={(e) => updateField('postal_code', e.target.value)} />
        </label>
        <label>
          <span className="form-label">{isEs ? 'Pais' : 'Country'}</span>
          <input className={inputStyle} autoComplete="country-name" value={form.country} onChange={(e) => updateField('country', e.target.value)} />
        </label>
      </div>

      <label className="mt-5 flex items-center gap-2 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
        <input
          type="checkbox"
          checked={form.marketing_opt_in}
          onChange={(e) => updateField('marketing_opt_in', e.target.checked)}
          style={{ accentColor: GOLD }}
        />
        {isEs ? 'Acepto recibir actualizaciones ocasionales.' : 'I agree to receive occasional updates.'}
      </label>

      {message && <p className="mt-4 text-sm font-bold" style={{ color: GOLD }}>{message}</p>}
      {error && <p className="mt-4 text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>}

      <button type="submit" disabled={saving} className="gold-button mt-5 disabled:opacity-50">
        {saving ? (isEs ? 'Guardando...' : 'Saving...') : (isEs ? 'Guardar perfil' : 'Save Profile')}
      </button>
    </form>
  );
}
