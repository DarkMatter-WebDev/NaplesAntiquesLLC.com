'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppIcon } from '@/components/AppIcon';
import { runSocialPublishBatchInBackground } from '@/lib/social-background-publish';
import type { SocialQueueChannel } from '@/lib/social-queue-schedule';

const LABELS: Record<SocialQueueChannel, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
};

interface PublishInput {
  channel: SocialQueueChannel;
  productId: string;
  productTitle: string;
}

interface PublishTask extends PublishInput {
  id: string;
  status: 'running' | 'success' | 'error';
  message: string;
  items: PublishInput[];
  currentIndex: number;
  completedCount: number;
  total: number;
}

interface PublishStartResult {
  started: boolean;
  message?: string;
}

interface SocialBackgroundPublishContextValue {
  task: PublishTask | null;
  startPublish: (input: PublishInput) => PublishStartResult;
  startPublishBatch: (inputs: PublishInput[]) => PublishStartResult;
}

const SocialBackgroundPublishContext = createContext<SocialBackgroundPublishContextValue | null>(null);

export function useSocialBackgroundPublish() {
  const value = useContext(SocialBackgroundPublishContext);
  if (!value) throw new Error('useSocialBackgroundPublish must be used inside SocialBackgroundPublishProvider.');
  return value;
}

export default function SocialBackgroundPublishProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const activeRef = useRef(false);
  const [task, setTask] = useState<PublishTask | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (task?.status !== 'success') return;
    const timer = window.setTimeout(() => setTask(null), 5_000);
    return () => window.clearTimeout(timer);
  }, [task?.id, task?.status]);

  const launchBatch = useCallback((items: PublishInput[], startIndex = 0): PublishStartResult => {
    if (activeRef.current) {
      return { started: false, message: 'Another social post is already uploading. Let it finish before starting another.' };
    }
    if (items.length === 0 || startIndex >= items.length) {
      return { started: false, message: 'Select at least one ready social post.' };
    }

    const channel = items[0].channel;
    if (items.some((item) => item.channel !== channel)) {
      return { started: false, message: 'Bulk publishing must stay within one social channel.' };
    }

    const input = items[startIndex];
    const id = `${Date.now()}-${channel}-${input.productId}`;
    activeRef.current = true;
    setExpanded(false);
    setTask({
      ...input,
      id,
      status: 'running',
      message: `Uploading ${startIndex + 1} of ${items.length} to ${LABELS[channel]}…`,
      items,
      currentIndex: startIndex,
      completedCount: startIndex,
      total: items.length,
    });

    void runSocialPublishBatchInBackground(items.slice(startIndex), {
      onItemStart: (_item, batchIndex) => {
        const index = startIndex + batchIndex;
        const currentItem = items[index];
        setTask((current) => current?.id === id
          ? {
              ...current,
              ...currentItem,
              currentIndex: index,
              completedCount: index,
              message: `Uploading ${index + 1} of ${items.length} to ${LABELS[channel]}…`,
            }
          : current);
      },
      onProgress: ({ message }) => {
        setTask((current) => current?.id === id ? { ...current, message } : current);
      },
      onItemComplete: (_item, batchIndex, _total, result) => {
        const completedCount = startIndex + batchIndex + 1;
        setTask((current) => current?.id === id
          ? { ...current, completedCount, message: result.message }
          : current);
      },
    }).then(() => {
      activeRef.current = false;
      setExpanded(true);
      setTask((current) => current?.id === id
        ? {
            ...current,
            status: 'success',
            completedCount: items.length,
            message: items.length === 1
              ? `Posted to ${LABELS[channel]}.`
              : `Posted all ${items.length} selected posts to ${LABELS[channel]}.`,
          }
        : current);
      router.refresh();
    }).catch((error: unknown) => {
      activeRef.current = false;
      setExpanded(true);
      setTask((current) => current?.id === id
        ? {
            ...current,
            status: 'error',
            message: error instanceof Error ? error.message : `Could not post to ${LABELS[channel]}.`,
          }
        : current);
      router.refresh();
    });

    return { started: true };
  }, [router]);

  const startPublish = useCallback((input: PublishInput) => launchBatch([input]), [launchBatch]);
  const startPublishBatch = useCallback((inputs: PublishInput[]) => launchBatch(inputs), [launchBatch]);

  const dismiss = () => {
    if (task?.status === 'running') return;
    setTask(null);
    setExpanded(false);
  };

  const retry = () => {
    if (!task || task.status !== 'error') return;
    const { items, completedCount } = task;
    setTask(null);
    window.setTimeout(() => launchBatch(items, completedCount), 0);
  };

  const label = task ? LABELS[task.channel] : '';

  return (
    <SocialBackgroundPublishContext.Provider value={{ task, startPublish, startPublishBatch }}>
      {children}
      {task && (
        <aside
          className={`social-publish-widget ${expanded ? 'is-expanded' : ''} is-${task.status}`}
          aria-live="polite"
          aria-label={`${label} background publishing status`}
        >
          <button
            type="button"
            className="social-publish-widget-summary"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            <span className="social-publish-orb" aria-hidden="true">
              <AppIcon name={task.status === 'running' ? 'sync' : task.status === 'success' ? 'check_circle' : 'error'} />
            </span>
            <span className="min-w-0 text-left">
              <strong>
                {task.status === 'running'
                  ? task.total > 1 ? `Posting ${task.currentIndex + 1} of ${task.total} to ${label}` : `Uploading to ${label}`
                  : task.status === 'success'
                    ? task.total > 1 ? `Posted ${task.total} to ${label}` : `Posted to ${label}`
                    : task.total > 1 ? `${label} batch needs attention` : `${label} upload needs attention`}
              </strong>
              <small>
                {task.status === 'running'
                  ? task.total > 1 ? `${task.completedCount} of ${task.total} complete` : 'Working in the background'
                  : task.status === 'success' ? 'Upload complete' : 'Click for details'}
              </small>
            </span>
            <AppIcon name={expanded ? 'expand_more' : 'expand_less'} className="social-publish-widget-chevron" aria-hidden="true" />
          </button>

          {expanded && (
            <div className="social-publish-widget-details">
              <p className="social-publish-widget-product">
                {task.status === 'success' && task.total > 1 ? `${task.total} selected posts` : task.productTitle}
              </p>
              <p>{task.message}</p>
              {task.status === 'running' && <p>You can keep using the site. This window will update as each post goes live.</p>}
              {task.status === 'error' && task.total > 1 && task.completedCount > 0 && (
                <p>{task.completedCount} of {task.total} posts completed before this error. Retry resumes with this post.</p>
              )}
              <div className="social-publish-widget-actions">
                {task.status === 'running' ? (
                  <button type="button" className="outline-button text-xs" onClick={() => setExpanded(false)}>Minimize</button>
                ) : task.status === 'error' ? (
                  <>
                    <button type="button" className="outline-button text-xs" onClick={dismiss}>Dismiss</button>
                    <button type="button" className="gold-button text-xs" onClick={retry}>Try again</button>
                  </>
                ) : (
                  <button type="button" className="outline-button text-xs" onClick={dismiss}>Close</button>
                )}
              </div>
            </div>
          )}
        </aside>
      )}
    </SocialBackgroundPublishContext.Provider>
  );
}
