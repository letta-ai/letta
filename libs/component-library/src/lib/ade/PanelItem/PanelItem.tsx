import * as React from 'react';
import type { PropsWithChildren } from 'react';
import { Frame } from '../../framing/Frame/Frame';

type PanelContentProps = PropsWithChildren<Record<never, string>>;

export function PanelItem(props: PanelContentProps) {
  return (
    <Frame paddingX="xxsmall" paddingY="xsmall">
      {props.children}
    </Frame>
  );
}
