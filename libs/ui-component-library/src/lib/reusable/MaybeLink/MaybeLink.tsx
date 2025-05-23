import React, { forwardRef } from 'react';
import Link from 'next/link';

interface MaybeLinkProps {
  href?: string | undefined;
  testId?: string;
  children: React.ReactNode;
}

export const MaybeLink = forwardRef<HTMLAnchorElement, MaybeLinkProps>(
  function MaybeLink(props, ref) {
    const { href, children, testId } = props;

    if (href) {
      return (
        <Link data-testid={testId} ref={ref} href={href}>
          {children}
        </Link>
      );
    }

    return <>{children}</>;
  },
);
