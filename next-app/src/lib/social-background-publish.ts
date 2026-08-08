import type { SocialQueueChannel } from './social-queue-schedule';

export interface SocialPublishProgress {
  message: string;
  attempt: number;
}

export interface SocialPublishResult {
  message: string;
  permalink: string | null;
}

interface RunOptions {
  fetcher?: typeof fetch;
  onProgress?: (progress: SocialPublishProgress) => void;
  retryDelayMs?: number;
}

export interface SocialPublishBatchItem {
  channel: SocialQueueChannel;
  productId: string;
}

interface BatchRunOptions extends RunOptions {
  onItemStart?: (item: SocialPublishBatchItem, index: number, total: number) => void;
  onItemComplete?: (item: SocialPublishBatchItem, index: number, total: number, result: SocialPublishResult) => void;
}

const LABELS: Record<SocialQueueChannel, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
};

export async function runSocialPublishInBackground(
  channel: SocialQueueChannel,
  productId: string,
  options: RunOptions = {},
): Promise<SocialPublishResult> {
  const fetcher = options.fetcher ?? fetch;
  const retryDelayMs = options.retryDelayMs ?? 1_200;
  let lastMessage = `Could not publish this ${LABELS[channel]} post.`;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    options.onProgress?.({
      attempt,
      message: attempt === 1
        ? `Uploading to ${LABELS[channel]}…`
        : `${LABELS[channel]} is still processing the upload…`,
    });

    const response = await fetcher(`/api/admin/${channel}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, action: 'publish' }),
    });
    const data = await response.json().catch(() => null) as {
      state?: string;
      message?: string;
      error?: string;
      permalink?: string | null;
    } | null;

    lastMessage = data?.message || data?.error || lastMessage;
    if (!response.ok) throw new Error(lastMessage);
    if (data?.state === 'published') {
      return { message: lastMessage, permalink: data.permalink ?? null };
    }
    if (data?.state !== 'publishing') throw new Error(lastMessage);

    options.onProgress?.({ attempt, message: lastMessage });
    if (attempt < 4 && retryDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw new Error(lastMessage);
}

export async function runSocialPublishBatchInBackground(
  items: SocialPublishBatchItem[],
  options: BatchRunOptions = {},
): Promise<SocialPublishResult[]> {
  if (items.length === 0) throw new Error('Select at least one ready social post.');
  const channel = items[0].channel;
  if (items.some((item) => item.channel !== channel)) {
    throw new Error('Bulk publishing must stay within one social channel.');
  }

  const results: SocialPublishResult[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    options.onItemStart?.(item, index, items.length);
    const result = await runSocialPublishInBackground(channel, item.productId, {
      fetcher: options.fetcher,
      onProgress: options.onProgress,
      retryDelayMs: options.retryDelayMs,
    });
    results.push(result);
    options.onItemComplete?.(item, index, items.length, result);
  }
  return results;
}
