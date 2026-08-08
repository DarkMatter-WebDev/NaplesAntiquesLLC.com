'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { AppIcon } from '@/components/AppIcon';

export default function SocialQueuesRefreshButton() {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="outline-button inline-flex items-center gap-2 text-xs disabled:opacity-50"
      disabled={refreshing}
      aria-busy={refreshing}
      onClick={() => startTransition(() => router.refresh())}
    >
      <AppIcon name="sync" aria-hidden="true" style={{ fontSize: '1rem' }} />
      {refreshing ? 'Refreshing…' : 'Refresh queues'}
    </button>
  );
}
