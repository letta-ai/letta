import * as React from 'react';
import type { PropsWithChildren } from 'react';

type VisibleOnMobileProps = PropsWithChildren;

export function VisibleOnMobile(props: VisibleOnMobileProps) {
  return (
    <div className="contents largerThanMobile:hidden">{props.children}</div>
  );
}
