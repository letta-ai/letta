'use client';
import * as React from 'react';
import type { PropsWithChildren } from 'react';
import { useDebouncedValue, useViewportSize } from '@mantine/hooks';

interface VisibleOnMobileProps extends PropsWithChildren {
  checkWithJs?: boolean;
}

export function VisibleOnMobile(props: VisibleOnMobileProps) {
  const { checkWithJs = false } = props;

  const { width = 0 } = useViewportSize();

  const [debouncedWidth] = useDebouncedValue(width, 100);

  if (checkWithJs) {
    if (debouncedWidth > 640) {
      return;
    }

    return props.children;
  }

  return (
    <div className="contents largerThanMobile:hidden">{props.children}</div>
  );
}
