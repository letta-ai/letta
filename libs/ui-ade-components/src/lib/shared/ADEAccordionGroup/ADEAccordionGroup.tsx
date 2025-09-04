'use client';

import { useRef, useState, useMemo } from 'react';
import React from 'react';
import './ADEAccordionGroup.scss';
import {
  ADEAccordionPanels,
  type PanelItem,
} from './ADEAccordionPanels/ADEAccordionPanels';

interface ADEAccordionGroupProps {
  panels: PanelItem[];
  topOffset?: number;
}

export function ADEAccordionGroup(props: ADEAccordionGroupProps) {
  const { panels } = props;
  const panelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [openStates, setOpenStates] = useState<boolean[]>(
    panels.map((panel) => {
      if (typeof panel.defaultOpen === 'boolean') {
        return panel.defaultOpen;
      }

      return true;
    }),
  );

  const handleOpenStateChange = (idx: number) => {
    setOpenStates((prev) => {
      const newStates = [...prev];
      newStates[idx] = !newStates[idx];
      return newStates;
    });
  };

  const lastOpenIndex = useMemo(() => {
    return openStates.lastIndexOf(true);
  }, [openStates]);

  return (
    <div className="flex flex-col h-full overflow-hidden ">
      <div
        ref={containerRef}
        className="overflow-auto stabilize-scrollbar ade-accordion-group transition-[height] flex flex-col flex-1"
      >
        <ADEAccordionPanels
          panels={panels}
          openStates={openStates}
          onOpenStateChange={handleOpenStateChange}
          lastOpenIndex={lastOpenIndex}
          panelRefs={panelRefs}
        />
      </div>
    </div>
  );
}
