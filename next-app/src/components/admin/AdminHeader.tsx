import Link from 'next/link';
import type { ReactNode } from 'react';
import AdminMessagesLink from './AdminMessagesLink';

const GOLD = '#735c00';

export type AdminSection = 'products' | 'orders' | 'messages' | 'inquiries' | 'subscribers' | 'users';

const linkStyle = {
  fontSize: '0.8125rem',
  color: '#555',
  textDecoration: 'none',
  textUnderlineOffset: '3px',
} as const;

const activeStyle = {
  ...linkStyle,
  fontWeight: 600,
  textDecoration: 'underline',
} as const;

const productsLinkStyle = {
  ...linkStyle,
  color: GOLD,
} as const;

const activeProductsStyle = {
  ...productsLinkStyle,
  fontWeight: 600,
  textDecoration: 'underline',
} as const;

function AdminNavItem({
  href,
  active,
  children,
  products = false,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
  products?: boolean;
}) {
  if (active) {
    return <span style={products ? activeProductsStyle : activeStyle}>{children}</span>;
  }

  return (
    <Link href={href} style={products ? productsLinkStyle : linkStyle}>
      {children}
    </Link>
  );
}

export default function AdminHeader({
  adminBasePath,
  active,
  unreadMessagesCount,
  userEmail,
  rightContent,
}: {
  adminBasePath: string;
  active: AdminSection;
  unreadMessagesCount: number;
  userEmail?: string | null;
  rightContent?: ReactNode;
}) {
  const homeHref = adminBasePath.startsWith('/es') ? '/es' : '/';

  return (
    <header
      style={{
        borderBottom: '1px solid rgba(115,92,0,0.2)',
        padding: '0.75rem 2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1.5rem',
        background: 'white',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        flexWrap: 'wrap',
      }}
    >
      <Link
        href={homeHref}
        style={{
          fontSize: '0.8125rem',
          color: GOLD,
          textDecoration: 'none',
          textUnderlineOffset: '3px',
        }}
      >
        ← Home
      </Link>
      <span
        style={{
          fontSize: '0.55rem',
          fontWeight: 700,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          background: GOLD,
          color: 'white',
          padding: '0.2rem 0.5rem',
        }}
      >
        Admin
      </span>
      <AdminNavItem href={adminBasePath} active={active === 'products'} products>
        Products
      </AdminNavItem>
      <AdminNavItem href={`${adminBasePath}/orders`} active={active === 'orders'}>
        Orders
      </AdminNavItem>
      <AdminMessagesLink
        href={`${adminBasePath}/messages`}
        unreadCount={unreadMessagesCount}
        active={active === 'messages'}
        style={active === 'messages' ? activeStyle : linkStyle}
      />
      <AdminNavItem href={`${adminBasePath}/inquiries`} active={active === 'inquiries'}>
        Inquiries
      </AdminNavItem>
      <AdminNavItem href={`${adminBasePath}/subscribers`} active={active === 'subscribers'}>
        Subscribers
      </AdminNavItem>
      <AdminNavItem href={`${adminBasePath}/users`} active={active === 'users'}>
        Users
      </AdminNavItem>
      <span
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        {rightContent}
        {userEmail && (
          <span style={{ fontSize: '0.75rem', color: '#aaa' }}>
            {userEmail}
          </span>
        )}
      </span>
    </header>
  );
}
