export type SocialPublishChannel = 'instagram' | 'facebook';
export type SocialCombinedChannelStatus = 'loading' | 'ready' | 'queued' | 'published' | 'needs-prepare' | 'blocked';

export function canQueueBothSocialChannels(
  statuses: Record<SocialPublishChannel, SocialCombinedChannelStatus>,
  captionsMatch: boolean,
): boolean {
  return captionsMatch
    && statuses.instagram === 'ready'
    && statuses.facebook === 'ready';
}

export function otherSocialPublishChannel(channel: SocialPublishChannel): SocialPublishChannel {
  return channel === 'instagram' ? 'facebook' : 'instagram';
}

/**
 * Preparing the second channel from the combined review should preserve the
 * opening the operator already reviewed on the ready channel. Fall back to the
 * target's own preview only when there is no ready source to copy from.
 */
export function selectCrossChannelCaptionOpening(params: {
  targetOpening: string | null | undefined;
  sourceOpening: string | null | undefined;
  sourceIsReady: boolean;
}): string | null {
  if (params.sourceIsReady && params.sourceOpening?.trim()) {
    return params.sourceOpening;
  }
  return params.targetOpening?.trim() ? params.targetOpening : null;
}

export function socialCaptionOpeningsMatch(
  first: string | null | undefined,
  second: string | null | undefined,
): boolean {
  return Boolean(first?.trim() && second?.trim() && first.trim() === second.trim());
}

function splitHashtagFooter(text: string): { body: string; hashtags: string | null } {
  const lines = text.trim().split('\n');
  const candidate = lines.at(-1)?.trim() ?? '';
  const tokens = candidate.split(/\s+/).filter(Boolean);
  const isHashtagLine = tokens.length > 0
    && tokens.every((token) => /^#[\p{L}\p{N}_]+$/u.test(token));

  return isHashtagLine
    ? { body: lines.slice(0, -1).join('\n').trim(), hashtags: candidate }
    : { body: text.trim(), hashtags: null };
}

/** Copy all reviewed source wording and swap only the target hashtag footer. */
export function replaceSocialCaptionHashtags(sourceCaption: string, targetCaption: string): string {
  const source = splitHashtagFooter(sourceCaption);
  const target = splitHashtagFooter(targetCaption);
  return target.hashtags ? `${source.body}\n\n${target.hashtags}` : source.body;
}

function platformLinkBlock(lines: string[]): { start: number; end: number } | null {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (/^Shop:\s+/i.test(line)) return { start: index, end: index };
    if (/^Store link in bio$/i.test(line) && /^Item:\s+/i.test(lines[index + 1]?.trim() ?? '')) {
      return { start: index, end: index + 1 };
    }
  }
  return null;
}

/**
 * Preserve reviewed wording while applying the target's intentional platform
 * fields: its compact link block and hashtag footer.
 */
export function adaptSocialCaptionForTarget(sourceCaption: string, targetCaption: string): string {
  const source = splitHashtagFooter(sourceCaption);
  const target = splitHashtagFooter(targetCaption);
  const sourceLines = source.body.split('\n');
  const targetLines = target.body.split('\n');
  const sourceLink = platformLinkBlock(sourceLines);
  const targetLink = platformLinkBlock(targetLines);

  if (sourceLink && targetLink) {
    sourceLines.splice(
      sourceLink.start,
      sourceLink.end - sourceLink.start + 1,
      ...targetLines.slice(targetLink.start, targetLink.end + 1),
    );
  }

  const body = sourceLines.join('\n').trim();
  return target.hashtags ? `${body}\n\n${target.hashtags}` : body;
}
