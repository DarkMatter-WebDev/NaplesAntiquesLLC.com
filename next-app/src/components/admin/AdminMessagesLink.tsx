import Link from 'next/link';
import type { CSSProperties } from 'react';

const GOLD = '#735c00';

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span
      aria-label={`${count} unread message${count === 1 ? '' : 's'}`}
      style={{
        minWidth: '1rem',
        height: '1rem',
        padding: '0 0.28rem',
        borderRadius: '999px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: GOLD,
        color: 'white',
        fontSize: '0.58rem',
        fontWeight: 800,
        lineHeight: 1,
        boxShadow: '0 0 0 2px white',
      }}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

export default function AdminMessagesLink({
  href,
  unreadCount,
  active = false,
  className,
  style,
}: {
  href: string;
  unreadCount: number;
  active?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const content = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
      <span>Messages</span>
      <Badge count={unreadCount} />
    </span>
  );

  if (active) {
    return (
      <span
        className={className}
        style={{
          fontSize: '0.8125rem',
          color: '#555',
          fontWeight: 600,
          textDecoration: 'underline',
          textUnderlineOffset: '3px',
          ...style,
        }}
      >
        {content}
      </span>
    );
  }

  return (
    <Link href={href} className={className} style={style}>
      {content}
    </Link>
  );
}
