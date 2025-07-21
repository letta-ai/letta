import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import type { ReactNode } from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import { cn } from '@letta-cloud/ui-styles';

interface PanelItem {
  id: string;
  label: string;
  content: ReactNode;
  minHeight?: number;
}

interface StickyPanelsProps {
  panels: PanelItem[];
  position?: 'bottom' | 'top';
  onClick?: (id: string) => void;
}

interface StickyLabelProps {
  label: string;
}

function StickyLabel({ label }: StickyLabelProps) {
  return (
    <HStack
      align="center"
      fullHeight
      className="h-[32px] px-3 hover:bg-secondary-hover"
      as="span"
    >
      <Typography
        uppercase
        bold
        noWrap
        overflow="ellipsis"
        color="default"
        variant="body4"
        overrideEl="span"
      >
        {label}
      </Typography>
    </HStack>
  );
}

export function StickyPanels({
  position = 'top',
  panels,
  onClick,
}: StickyPanelsProps) {
  const stickyBorder = <div className="h-[1px] w-full border-t" />;
  const stickyStyle = cn(
    'bg-background-grey w-full sticky cursor-pointer z-[1]',
    position === 'top' ? ' top-0 border-b' : ' bottom-0 border-t',
  );

  return (
    <VStack className={stickyStyle} gap={false}>
      {panels.map((panel, i) => (
        <div
          key={panel.id}
          onClick={() => {
            if (onClick) {
              onClick(panel.id);
            }
          }}
        >
          <StickyLabel label={panel.label} />
          {i < panels.length - 1 && stickyBorder}
        </div>
      ))}
    </VStack>
  );
}
