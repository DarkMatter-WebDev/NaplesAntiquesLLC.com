'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  campaignId: string;
  subject: string;
};

export default function CampaignDeleteButton({ campaignId, subject }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function deleteCampaign() {
    if (busy) return;
    const confirmed = window.confirm(`Delete this campaign history record?\n\n${subject}\n\nThis removes the campaign row and its stored send/event analytics.`);
    if (!confirmed) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/marketing/campaigns/${campaignId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not delete campaign.');
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not delete campaign.');
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="rounded-full border px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.12em] transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
      style={{
        borderColor: 'color-mix(in srgb, var(--color-error) 34%, var(--color-outline-variant))',
        color: 'var(--color-error)',
        fontFamily: 'var(--font-label)',
      }}
      disabled={busy}
      onClick={deleteCampaign}
      title="Delete this campaign history record"
    >
      {busy ? 'Deleting...' : 'Delete'}
    </button>
  );
}
