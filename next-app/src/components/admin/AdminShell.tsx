'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Product } from '@/types/product';

interface Props {
  initialProducts: Product[];
  userEmail: string;
}

const CATEGORIES = ['Gold', 'Silver'] as const;
const STATUSES = ['Available', 'Sold'] as const;
const PRICE_MODES = [
  { value: 'spot-multiplier', label: 'Spot × Multiplier' },
  { value: 'manual', label: 'Manual / Fixed' },
] as const;

function emptyProduct(): Omit<Product, 'created_at' | 'updated_at'> {
  return {
    id: '',
    category: 'Gold',
    title: '',
    title_es: '',
    price_label: null,
    manual_price_label: null,
    price_mode: 'spot-multiplier',
    purity: null,
    weight_grams: null,
    pricing_multiplier: 1.25,
    status: 'Available',
    images: [],
    description: '',
    description_es: '',
    details: [],
    details_es: [],
    tags: [],
    tags_es: [],
    private_price_label: null,
    sort_order: 0,
  };
}

export default function AdminShell({ initialProducts, userEmail }: Props) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ReturnType<typeof emptyProduct> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const flash = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3500);
  };

  const supabase = createClient();

  // --- Sign out ---
  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  // --- Open add/edit modal ---
  function openAdd() {
    setEditing(emptyProduct());
    setIsNew(true);
  }

  function openEdit(p: Product) {
    setEditing({ ...p });
    setIsNew(false);
  }

  function closeModal() {
    setEditing(null);
  }

  // --- Image upload ---
  const handleImageUpload = useCallback(async (files: FileList) => {
    if (!editing) return;
    setUploading(true);

    const urls: string[] = [];
    for (const file of Array.from(files)) {
      // Compress to WebP via canvas
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const MAX = 1200;
      const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((res) =>
        canvas.toBlob((b) => res(b!), 'image/webp', 0.85)
      );

      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
      const path = `products/${filename}`;

      const { error } = await supabase.storage
        .from('product-images')
        .upload(path, blob, { contentType: 'image/webp', upsert: false });

      if (error) {
        flash(`Upload failed: ${error.message}`, false);
        continue;
      }

      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      urls.push(data.publicUrl);
    }

    setEditing((prev) => prev ? { ...prev, images: [...prev.images, ...urls] } : prev);
    setUploading(false);
    if (urls.length) flash(`${urls.length} image(s) uploaded`);
  }, [editing, supabase]);

  function removeImage(idx: number) {
    setEditing((prev) => prev ? { ...prev, images: prev.images.filter((_, i) => i !== idx) } : prev);
  }

  // --- Save product ---
  async function handleSave() {
    if (!editing) return;
    setSaving(true);

    const payload = {
      ...editing,
      id: editing.id || editing.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now(),
      purity: editing.purity ?? null,
      weight_grams: editing.weight_grams ?? null,
      pricing_multiplier: editing.pricing_multiplier ?? null,
    };

    const { data, error } = isNew
      ? await supabase.from('products').insert(payload).select().single()
      : await supabase.from('products').update(payload).eq('id', payload.id).select().single();

    if (error) {
      flash(error.message, false);
      setSaving(false);
      return;
    }

    setProducts((prev) =>
      isNew ? [data, ...prev] : prev.map((p) => p.id === data.id ? data : p)
    );
    flash(isNew ? 'Product added' : 'Product saved');
    setSaving(false);
    closeModal();
  }

  // --- Delete product ---
  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from('products').delete().eq('id', deleteTarget.id);
    if (error) { flash(error.message, false); return; }
    setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    flash('Product deleted');
    setDeleteTarget(null);
  }

  // --- Filtered list ---
  const filtered = products.filter((p) =>
    !search || p.title.toLowerCase().includes(search.toLowerCase())
  );

  const total = products.length;
  const available = products.filter((p) => p.status === 'Available').length;
  const sold = products.filter((p) => p.status === 'Sold').length;
  const goldCount = products.filter((p) => p.category === 'Gold').length;

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>

      {/* Top bar */}
      <header
        className="sticky top-0 z-40 border-b flex items-center justify-between px-4 md:px-8 py-3 gap-4"
        style={{ background: 'var(--color-background)', borderColor: 'var(--color-outline-variant)' }}
      >
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/"
            className="text-xs font-bold uppercase tracking-widest flex-shrink-0"
            style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
            ← Site
          </Link>
          <span
            className="text-sm font-bold truncate"
            style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
            Product Admin
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs hidden md:block truncate" style={{ color: 'var(--color-on-surface-variant)' }}>
            {userEmail}
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            className="outline-button text-xs"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">

        {/* Flash message */}
        {msg && (
          <div
            className="mb-6 px-4 py-3 text-sm font-medium"
            style={{
              background: msg.ok ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'color-mix(in srgb, var(--color-error) 12%, transparent)',
              color: msg.ok ? 'var(--color-primary)' : 'var(--color-error)',
              border: `1px solid ${msg.ok ? 'color-mix(in srgb, var(--color-primary) 30%, transparent)' : 'color-mix(in srgb, var(--color-error) 30%, transparent)'}`,
            }}
          >
            {msg.text}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total', value: total },
            { label: 'Available', value: available },
            { label: 'Sold', value: sold },
            { label: 'Gold Items', value: goldCount },
          ].map(({ label, value }) => (
            <div key={label}
              className="border p-4"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
              <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>{value}</p>
              <p className="text-xs uppercase tracking-wide mt-1" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <input
            type="search"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-field flex-1 min-w-48"
          />
          <button type="button" onClick={openAdd} className="gold-button text-sm flex-shrink-0">
            + Add Product
          </button>
        </div>

        {/* Product table */}
        <div className="border" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}>
                  {['Image', 'Title', 'Category', 'Purity', 'Weight', 'Price', 'Status', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wide whitespace-nowrap"
                      style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}
                    className="border-b hover:bg-[color:var(--color-surface-container-low)] transition-colors"
                    style={{ borderColor: 'var(--color-outline-variant)' }}>
                    <td className="px-4 py-3">
                      {p.images?.[0] ? (
                        <div className="relative w-10 h-10 flex-shrink-0">
                          <Image
                            src={p.images[0]}
                            alt={p.title}
                            fill
                            sizes="40px"
                            className="object-cover"
                            unoptimized={p.images[0].startsWith('/assets/')}
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 flex items-center justify-center text-lg"
                          style={{ background: 'var(--color-surface-container)' }}>📷</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium max-w-xs" style={{ color: 'var(--color-on-surface)' }}>
                      <span className="line-clamp-2">{p.title}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>{p.category}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {p.purity ? `${p.purity}${p.purity <= 24 ? 'k' : ''}` : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {p.weight_grams ? `${p.weight_grams}g` : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium" style={{ color: 'var(--color-primary)' }}>
                      {p.price_mode === 'manual' ? (p.manual_price_label ?? '—') : `×${p.pricing_multiplier ?? '?'}`}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className="text-[0.6rem] font-bold uppercase tracking-widest px-2 py-0.5"
                        style={{
                          background: p.status === 'Available' ? 'var(--color-primary)' : 'var(--color-on-surface)',
                          color: p.status === 'Available' ? 'var(--color-on-primary)' : 'var(--color-surface)',
                        }}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => openEdit(p)}
                          className="text-xs font-bold uppercase tracking-wide hover:underline"
                          style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                          Edit
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(p)}
                          className="text-xs font-bold uppercase tracking-wide hover:underline"
                          style={{ color: 'var(--color-error)', fontFamily: 'var(--font-label)' }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm"
                      style={{ color: 'var(--color-on-surface-variant)' }}>
                      No products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit / Add Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div
            className="w-full max-w-2xl border flex flex-col"
            style={{ background: 'var(--color-background)', borderColor: 'var(--color-outline-variant)' }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: 'var(--color-outline-variant)' }}>
              <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
                {isNew ? 'Add Product' : 'Edit Product'}
              </h2>
              <button type="button" onClick={closeModal}
                className="text-sm font-bold uppercase tracking-wide"
                style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                ✕ Close
              </button>
            </div>

            <div className="p-6 flex flex-col gap-5 overflow-y-auto">

              {/* ID (new only) */}
              {isNew && (
                <div>
                  <label className="form-label">ID (slug, auto-generated if blank)</label>
                  <input className="form-field w-full" placeholder="my-product-slug"
                    value={editing.id}
                    onChange={(e) => setEditing({ ...editing, id: e.target.value })} />
                </div>
              )}

              {/* Title */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Title (English)</label>
                  <input className="form-field w-full" value={editing.title}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Title (Spanish)</label>
                  <input className="form-field w-full" value={editing.title_es ?? ''}
                    onChange={(e) => setEditing({ ...editing, title_es: e.target.value })} />
                </div>
              </div>

              {/* Category + Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Category</label>
                  <select className="form-field w-full" value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value as 'Gold' | 'Silver' })}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select className="form-field w-full" value={editing.status}
                    onChange={(e) => setEditing({ ...editing, status: e.target.value as 'Available' | 'Sold' })}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Pricing */}
              <div>
                <label className="form-label">Price Mode</label>
                <select className="form-field w-full mb-3" value={editing.price_mode}
                  onChange={(e) => setEditing({ ...editing, price_mode: e.target.value as 'spot-multiplier' | 'manual' })}>
                  {PRICE_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>

                {editing.price_mode === 'spot-multiplier' ? (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="form-label">Purity (k or fineness)</label>
                      <input type="number" className="form-field w-full"
                        value={editing.purity ?? ''}
                        onChange={(e) => setEditing({ ...editing, purity: e.target.value ? Number(e.target.value) : null })} />
                    </div>
                    <div>
                      <label className="form-label">Weight (grams)</label>
                      <input type="number" step="0.01" className="form-field w-full"
                        value={editing.weight_grams ?? ''}
                        onChange={(e) => setEditing({ ...editing, weight_grams: e.target.value ? Number(e.target.value) : null })} />
                    </div>
                    <div>
                      <label className="form-label">Multiplier</label>
                      <input type="number" step="0.01" className="form-field w-full"
                        value={editing.pricing_multiplier ?? ''}
                        onChange={(e) => setEditing({ ...editing, pricing_multiplier: e.target.value ? Number(e.target.value) : null })} />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="form-label">Price Label</label>
                    <input className="form-field w-full" placeholder="$1,200 or Call for price"
                      value={editing.manual_price_label ?? ''}
                      onChange={(e) => setEditing({ ...editing, manual_price_label: e.target.value })} />
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Description (EN)</label>
                  <textarea rows={4} className="form-field w-full resize-y"
                    value={editing.description ?? ''}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Description (ES)</label>
                  <textarea rows={4} className="form-field w-full resize-y"
                    value={editing.description_es ?? ''}
                    onChange={(e) => setEditing({ ...editing, description_es: e.target.value })} />
                </div>
              </div>

              {/* Details */}
              <div>
                <label className="form-label">Details (one per line, EN)</label>
                <textarea rows={5} className="form-field w-full resize-y font-mono text-xs"
                  value={(editing.details ?? []).join('\n')}
                  onChange={(e) => setEditing({ ...editing, details: e.target.value.split('\n') })} />
              </div>

              {/* Sort order */}
              <div>
                <label className="form-label">Sort Order</label>
                <input type="number" className="form-field w-32"
                  value={editing.sort_order}
                  onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
              </div>

              {/* Images */}
              <div>
                <label className="form-label">Images</label>
                <label
                  className="flex flex-col items-center justify-center border-2 border-dashed p-6 cursor-pointer text-sm transition-colors mb-3"
                  style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}
                >
                  <input type="file" accept="image/*" multiple className="sr-only"
                    onChange={(e) => e.target.files && handleImageUpload(e.target.files)} />
                  {uploading ? 'Uploading…' : 'Click or drag images here (compressed to WebP automatically)'}
                </label>
                {editing.images.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {editing.images.map((img, i) => (
                      <div key={i} className="relative w-16 h-16 group">
                        <Image src={img} alt="" fill sizes="64px" className="object-cover"
                          unoptimized={img.startsWith('/assets/')} />
                        <button type="button"
                          onClick={() => removeImage(i)}
                          className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: 'rgba(0,0,0,0.55)' }}>
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t"
              style={{ borderColor: 'var(--color-outline-variant)' }}>
              <button type="button" onClick={closeModal} className="outline-button text-sm">
                Cancel
              </button>
              <button type="button" onClick={handleSave} disabled={saving} className="gold-button text-sm disabled:opacity-50">
                {saving ? 'Saving…' : isNew ? 'Add Product' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
        >
          <div
            className="w-full max-w-sm border p-6 flex flex-col gap-4"
            style={{ background: 'var(--color-background)', borderColor: 'var(--color-outline-variant)' }}
          >
            <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              Delete product?
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              &ldquo;{deleteTarget.title}&rdquo; will be permanently removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setDeleteTarget(null)} className="outline-button text-sm">
                Cancel
              </button>
              <button type="button" onClick={handleDelete}
                className="text-sm font-bold px-4 py-2"
                style={{ background: 'var(--color-error)', color: '#fff', fontFamily: 'var(--font-label)' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
