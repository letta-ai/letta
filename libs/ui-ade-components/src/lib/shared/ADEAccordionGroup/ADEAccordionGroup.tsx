'use client';

import { useRef, useState, useEffect, useMemo, Fragment } from 'react';
import {
  ChevronDownIcon,
  StickyPanels,
  Typography,
} from '@letta-cloud/ui-component-library';
import type { ReactNode } from 'react';
import React from 'react';
import { cn } from '@letta-cloud/ui-styles';
import './ADEAccordionGroup.scss';

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

interface ADEAccordionGroupProps {
  panels: PanelItem[];
  topOffset?: number;
}

const STICKY_HEADER_HEIGHT = 32; // Height of the sticky header in pixels

export function ADEAccordionGroup(props: ADEAccordionGroupProps) {
  const { panels, topOffset = 0 } = props;
  const panelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [visibleIds, setVisibleIds] = useState<number[]>([]);

  const [visibleTopPanelHeaderIds, setVisibleTopPanelHeaderIds] = useState<
    string[]
  >([]);
  const [visibleBottomPanelHeaderIds, setVisibleBottomPanelHeaderIds] =
    useState<string[]>([]);

  // Only first 3 panels show as top sticky to avoid confusion
  const middle = Math.min(3, Math.ceil(panels.length / 2));

  const mounted = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleIndices = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => {
            const id = entry.target.getAttribute('data-id');
            return panels.findIndex((p) => p.id === id);
          })
          .filter((i) => i !== -1); // remove unmatched (just in case)

        setVisibleIds(visibleIndices);
      },
      {
        root: containerRef.current,
        threshold: 0.1,
      },
    );

    panelRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [panels, visibleIds, visibleTopPanelHeaderIds]);

  useEffect(() => {
    if (!visibleIds.length || !mounted.current) {
      mounted.current = true;
      return;
    }
    const visSet = new Set(visibleIds);
    const invTop: string[] = [];
    const invBottom: string[] = [];

    for (let i = 0; i < middle; i++) {
      if (!visSet.has(i)) {
        invTop.push(panels[i].id);
      }
    }
    for (let i = middle; i < panels.length; i++) {
      if (!visSet.has(i)) {
        invBottom.push(panels[i].id);
      }
    }

    setVisibleTopPanelHeaderIds(invTop);
    setVisibleBottomPanelHeaderIds(invBottom);
  }, [visibleIds, panels, middle]);

  const panelsById = useMemo(
    () =>
      panels.reduce<Record<string, (typeof panels)[0]>>((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {}),
    [panels],
  );

  const topStickyPanels = useMemo(
    () => visibleTopPanelHeaderIds.map((id) => panelsById[id]).filter(Boolean),
    [visibleTopPanelHeaderIds, panelsById],
  );
  const bottomStickyPanels = useMemo(
    () =>
      visibleBottomPanelHeaderIds.map((id) => panelsById[id]).filter(Boolean),
    [visibleBottomPanelHeaderIds, panelsById],
  );

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
    }
  }

  const [openStates, setOpenStates] = useState<boolean[]>(
    panels.map((panel) => {
      if (typeof panel.defaultOpen === 'boolean') {
        return panel.defaultOpen;
      }

      return true;
    }),
  );

  const lastOpenIndex = useMemo(() => {
    return openStates.lastIndexOf(true);
  }, [openStates]);

  return (
    <div
      ref={containerRef}
      className="overflow-auto stabilize-scrollbar ade-accordion-group flex flex-col h-full"
    >
      {topStickyPanels.length > 0 && (
        <StickyPanels
          panels={topStickyPanels}
          onClick={handleScrollToAnchor}
          position="top"
        />
      )}
      {panels.map((panel, idx) => (
        <Fragment key={panel.id}>
          <ADEAccordionItem
            key={panel.id}
            item={panel}
            idx={idx}
            open={openStates[idx]}
            onOpenChange={() => {
              setOpenStates((prev) => {
                const newStates = [...prev];
                newStates[idx] = !newStates[idx];
                return newStates;
              });
            }}
            lastOpen={idx === lastOpenIndex}
            panelLength={panels.length}
            panelRefs={panelRefs}
          />
          {idx < panels.length - 1 && (
            <div className="h-[1px] min-h-[1px] bg-border w-fullplusscollbar" />
          )}
        </Fragment>
      ))}
      {bottomStickyPanels.length > 0 && (
        <StickyPanels
          panels={bottomStickyPanels}
          onClick={handleScrollToAnchor}
          position="bottom"
        />
      )}
    </div>
  );
}
