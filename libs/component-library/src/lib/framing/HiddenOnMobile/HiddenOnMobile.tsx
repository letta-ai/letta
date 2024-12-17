import * as React from 'react';
import type { PropsWithChildren } from 'react';
import { useDebouncedValue, useViewportSize } from '@mantine/hooks';

interface HiddenOnMobileProps extends PropsWithChildren {
  checkWithJs?: boolean;
}

export function HiddenOnMobile(props: HiddenOnMobileProps) {
  const { checkWithJs = false } = props;

  const { width } = useViewportSize();

  const [debouncedWidth] = useDebouncedValue(width, 100);

  if (checkWithJs) {
    if (debouncedWidth && debouncedWidth <= 640) {
      return;
    }

    return (
      <div className="hidden largerThanMobile:contents">{props.children}</div>
    );
  }

  return (
    <div className="hidden largerThanMobile:contents">{props.children}</div>
  );
}
