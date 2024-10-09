import * as React from 'react';
import type { PropsWithChildren } from 'react';

type HiddenOnMobileProps = PropsWithChildren;

export function HiddenOnMobile(props: HiddenOnMobileProps) {
  return (
    <div className="hidden largerThanMobile:contents">{props.children}</div>
  );
}
