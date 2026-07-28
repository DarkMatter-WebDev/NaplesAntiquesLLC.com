'use client';

import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { requestShopReturn } from '@/lib/shop-return';

interface Props {
  children: ReactNode;
  className?: string;
  href: string;
  productId: string;
  shopHref: string;
  style?: CSSProperties;
}

export default function ProductBackLink({
  children,
  className,
  href,
  productId,
  shopHref,
  style,
}: Props) {
  const router = useRouter();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) {
      return;
    }

    const returnHref = requestShopReturn(productId, shopHref);
    if (!returnHref) return;

    event.preventDefault();
    router.push(returnHref, { scroll: false });
  };

  return (
    <Link href={href} onClick={handleClick} className={className} style={style}>
      {children}
    </Link>
  );
}
