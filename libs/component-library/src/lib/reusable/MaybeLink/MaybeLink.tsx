import React, { forwardRef } from 'react';
import Link from 'next/link';

interface MaybeLinkProps {
  href?: string | undefined;
  children: React.ReactNode;
}

export const MaybeLink = forwardRef<HTMLAnchorElement, MaybeLinkProps>(
  function MaybeLink(props, ref) {
    const { href, children } = props;

    if (href) {
      return (
        <Link ref={ref} href={href}>
          {children}
        </Link>
      );
    }

    return <>{children}</>;
  }
);
