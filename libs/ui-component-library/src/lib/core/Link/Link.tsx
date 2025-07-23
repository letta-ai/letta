import * as React from 'react';
import type { LinkProps } from 'next/link';
import NextLink from 'next/link';
import type { PropsWithChildren } from 'react';
import { cn } from '@letta-cloud/ui-styles';

export function Link(
  props: LinkProps &
    PropsWithChildren & { target?: string; noUnderlineWithoutHover?: boolean },
) {
  return (
    <NextLink
      {...props}
      className={cn(
        'hover:underline',
        !props.noUnderlineWithoutHover ? 'underline' : '',
      )}
    />
  );
}
