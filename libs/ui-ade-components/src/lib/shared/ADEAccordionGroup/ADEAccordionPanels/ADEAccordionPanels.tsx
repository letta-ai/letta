import React, { Fragment } from 'react';
import type { ReactNode } from 'react';
import { ChevronDownIcon, Typography } from '@letta-cloud/ui-component-library';
import { cn } from '@letta-cloud/ui-styles';

interface PanelItem {
  id: string;
  label: string;
  content: ReactNode;
  WrapperComponent?: React.FunctionComponent<{
    children: ReactNode;
  }>;
  minHeight?: number;
  defaultOpen?: boolean;
}

interface ADEAccordionItemProps {
  item: PanelItem;
  idx: number;
  panelLength: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lastOpen?: boolean;
  panelRefs: React.MutableRefObject<Array<HTMLDivElement | null>>;
}

function ADEAccordionItem(props: ADEAccordionItemProps) {
  const { item: panel, panelRefs, idx, open, onOpenChange, lastOpen } = props;
  const { id, label, content, minHeight, WrapperComponent } = panel;

  const element = (
    <div
      ref={(el) => {
        panelRefs.current[idx] = el;
      }}
      /* if the last element, allow it to flex and fill the remaining space */
      className={cn(
        lastOpen ? 'flex-1' : '',
        'flex flex-col  ade-accordion-item border-r',
        open ? 'open' : 'close min-h-[32px]',
      )}
      data-id={id}
      data-testid={id}
    >
      <button
        data-testid={`accordion-trigger:${id}`}
        onClick={() => {
          onOpenChange(!open);
        }}
        className="w-full h-[32px]  flex justify-between px-2.5 cursor-pointer py-2"
      >
        <Typography
          uppercase
          noWrap
          overflow="ellipsis"
          color="default"
          variant="body4"
          className="font-bold"
        >
          {label}
        </Typography>
        {open ? (
          <ChevronDownIcon color="muted" />
        ) : (
          <ChevronDownIcon color="muted" className="rotate-180" />
        )}
      </button>
      <div style={{ minHeight }} className={cn('flex flex-col h-full  w-full')}>
        {content}
      </div>
    </div>
  );

  if (WrapperComponent) {
    return <WrapperComponent>{element}</WrapperComponent>;
  }

  return element;
}

interface ADEAccordionPanelsProps {
  panels: PanelItem[];
  openStates: boolean[];
  onOpenStateChange: (idx: number) => void;
  lastOpenIndex: number;
  panelRefs: React.MutableRefObject<Array<HTMLDivElement | null>>;
}

export function ADEAccordionPanels(props: ADEAccordionPanelsProps) {
  const { panels, openStates, onOpenStateChange, lastOpenIndex, panelRefs } =
    props;

  return (
    <>
      {panels.map((panel, idx) => (
        <Fragment key={panel.id}>
          <ADEAccordionItem
            key={panel.id}
            item={panel}
            idx={idx}
            open={openStates[idx]}
            onOpenChange={() => onOpenStateChange(idx)}
            lastOpen={idx === lastOpenIndex}
            panelLength={panels.length}
            panelRefs={panelRefs}
          />
          {idx < panels.length - 1 && (
            <div className="h-[1px] min-h-[1px] bg-border w-fullplusscollbar" />
          )}
        </Fragment>
      ))}
    </>
  );
}

export type { PanelItem };
