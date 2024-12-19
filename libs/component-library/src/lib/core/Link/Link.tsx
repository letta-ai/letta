import * as React from 'react';
import type { LinkProps } from 'next/link';
import NextLink from 'next/link';
import type { PropsWithChildren } from 'react';

export function Link(props: LinkProps & PropsWithChildren) {
  return <NextLink {...props} className="hover:underline" />;
}
