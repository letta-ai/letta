'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import { ADEAccordion, StickyPanels } from '@letta-cloud/ui-component-library';
import type { ReactNode } from 'react';
import React from 'react';

interface PanelItem {
  id: string;
  label: string;
  content: ReactNode;
  minHeight?: number;
}

interface ADEAccordionGroupProps {
  panels: PanelItem[];
  topOffset?: number;
}

const STICKY_HEADER_HEIGHT = 32; // Height of the sticky header in pixels

export function ADEAccordionGroup({
  panels,
  topOffset = 0,
}: ADEAccordionGroupProps) {
  const panelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [visibleIds, setVisibleIds] = useState<number[]>([]);

  const [visibleTopPanelHeaderIds, setVisibleTopPanelHeaderIds] = useState<
    string[]
  >([]);
  const [visibleBottomPanelHeaderIds, setVisibleBottomPanelHeaderIds] =
    useState<string[]>([]);

  const middle = Math.ceil(panels.length / 2);

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
        threshold: 0.3,
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

  return (
    <div ref={containerRef} className="overflow-auto">
      {topStickyPanels.length > 0 && (
        <StickyPanels
          panels={topStickyPanels}
          onClick={handleScrollToAnchor}
          position="top"
        />
      )}
      {panels.map((panel, idx) => (
        <div
          key={panel.id}
          ref={(el) => {
            panelRefs.current[idx] = el;
          }}
          data-id={panel.id}
        >
          <ADEAccordion
            id={panel.id}
            label={panel.label}
            minHeight={panel.minHeight}
          >
            {panel.content}
          </ADEAccordion>
          {idx < panels.length - 1 && <div className="h-[1px] bg-border" />}
        </div>
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
