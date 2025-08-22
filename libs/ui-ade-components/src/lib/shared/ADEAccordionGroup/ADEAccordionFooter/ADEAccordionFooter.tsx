import {
  Button,
  CaretDownIcon,
  HStack,
} from '@letta-cloud/ui-component-library';
import React, { useEffect, useRef, useState } from 'react';
import { type PanelItem } from '../ADEAccordionPanels/ADEAccordionPanels';

interface ADEAccordionFooterProps {
  panels: PanelItem[];
  panelRefs: React.MutableRefObject<Array<HTMLDivElement | null>>;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  handleScrollToAnchor: (panelId: string) => void;
}

export function ADEAccordionFooter(props: ADEAccordionFooterProps) {
  const { panels, panelRefs, containerRef, handleScrollToAnchor } = props;

  const [visibleIds, setVisibleIds] = useState<number[]>([]);
  const [visibleBottomPanelHeaderIds, setVisibleBottomPanelHeaderIds] =
    useState<string[]>([]);

  const mounted = useRef(false);
  const lastVisibleIds = useRef<number[]>([]);

  // Only first 3 panels show as top sticky to avoid confusion
  const middle = Math.min(3, Math.ceil(panels.length / 2));

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

        // only update if the visible indices have changed
        if (
          !lastVisibleIds.current &&
          visibleIndices.length === lastVisibleIds.current &&
          visibleIndices.every((v, i) => v === lastVisibleIds.current[i])
        ) {
          return;
        }
        lastVisibleIds.current = visibleIndices;

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
  }, [panels, containerRef, panelRefs]);

  useEffect(() => {
    if (!visibleIds.length || !mounted.current) {
      mounted.current = true;
      return;
    }
    const visSet = new Set(visibleIds);
    const invBottom: string[] = [];

    for (let i = middle; i < panels.length; i++) {
      if (!visSet.has(i)) {
        invBottom.push(panels[i].id);
      }
    }

    setVisibleBottomPanelHeaderIds(invBottom);
  }, [visibleIds, panels, middle]);

  const bottomHiddenPanels = new Set(
    visibleBottomPanelHeaderIds
      .map((id) => panels.find((p) => p.id === id))
      .filter(Boolean)
      .map((panel) => panel!.id),
  );
  return (
    <div
      style={{ height: bottomHiddenPanels.size ? '40px' : '0px' }}
      className="transition-[height] flex-shrink-0"
    >
      <HStack
        as="nav"
        padding="small"
        overflowX="hidden"
        overflowY="hidden"
        className="stabilize-scrollbar"
        gap={false}
        borderTop
        align="center"
        fullHeight
      >
        {panels.map((panel) => {
          const isVisible = bottomHiddenPanels.has(panel.id);

          if (!isVisible) {
            return null;
          }

          return (
            <div
              key={panel.id}
              className="sticky-button sticky-button-fade-in-and-appear"
            >
              <Button
                preIcon={<CaretDownIcon />}
                label={panel.label}
                size="xsmall"
                color="tertiary"
                onClick={() => {
                  handleScrollToAnchor(panel.id);
                }}
              ></Button>
            </div>
          );
        })}
      </HStack>
    </div>
  );
}
