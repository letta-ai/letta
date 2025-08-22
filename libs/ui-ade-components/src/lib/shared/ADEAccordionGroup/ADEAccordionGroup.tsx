'use client';

import { useRef, useState, useMemo } from 'react';
import React from 'react';
import './ADEAccordionGroup.scss';
import { ADEAccordionFooter } from './ADEAccordionFooter/ADEAccordionFooter';
import {
  ADEAccordionPanels,
  type PanelItem,
} from './ADEAccordionPanels/ADEAccordionPanels';

interface ADEAccordionGroupProps {
  panels: PanelItem[];
  topOffset?: number;
}

const STICKY_HEADER_HEIGHT = 32; // Height of the sticky header in pixels

export function ADEAccordionGroup(props: ADEAccordionGroupProps) {
  const { panels, topOffset = 0 } = props;
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

  function handleScrollToAnchor(targetSection: string) {
    const container = containerRef.current;
    const target = document.querySelector(`[data-id="${targetSection}"]`);
    const targetIndex = panels.findIndex((p) => p.id === targetSection);
    const diff = (targetIndex - 1) * STICKY_HEADER_HEIGHT; // to account for number of sticky headers

    if (container && target) {
      const targetTop = (target as HTMLElement).offsetTop;
      container.scrollTo({
        top: targetTop - topOffset - diff - STICKY_HEADER_HEIGHT, // adjust for sticky headers
        behavior: 'smooth',
      });

      // also open the panel if it's not already open
      setOpenStates((prev) => {
        const newStates = [...prev];
        if (!newStates[targetIndex]) {
          newStates[targetIndex] = true;
        }
        return newStates;
      });
    }
  }

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
      <ADEAccordionFooter
        panels={panels}
        panelRefs={panelRefs}
        containerRef={containerRef}
        handleScrollToAnchor={handleScrollToAnchor}
      />
    </div>
  );
}
