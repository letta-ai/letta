import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import {
  DRAG_TO_HANDLE_CLASSNAME,
  getPanelDragToHandleElId,
  getPanelHeaderElId,
  getPanelRenderElement,
  LETTA_DRAGGABLE_AREA_ID,
  usePanelContext,
  usePanelManagerContext,
} from '../Panel/Panel';
import { Cross2Icon } from '../../icons';
import ReactDOM from 'react-dom';

interface PanelBreadcrumbItem {
  title: string;
  onClick?: () => void;
}

interface TitleProps {
  title: PanelBreadcrumbItem[] | string;
}

function Title(props: TitleProps) {
  const { title } = props;

  if (Array.isArray(title)) {
    return (
      <HStack gap="small">
        {title.map((t, i) => (
          <>
            <button
              key={i}
              onClick={() => {
                if (t.onClick) {
                  t.onClick();
                }
              }}
            >
              <Typography className="hover:underline" key={i} bold>
                {t.title}
              </Typography>
            </button>
            {i < title.length - 1 && <Typography key={`${i}n`}>/</Typography>}
          </>
        ))}
      </HStack>
    );
  }

  return <Typography bold>{title}</Typography>;
}

export interface PanelHeaderProps {
  title: TitleProps['title'];
}

export function PanelHeader(props: PanelHeaderProps) {
  const { title } = props;
  const { id } = usePanelContext();
  const closestElementIndex = useRef<number | null>(null);
  const { deactivatePanel, changePanelOrder, activePanelWidths, activePanels } =
    usePanelManagerContext();

  const draggableElement = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDeactivatePanel = useCallback(
    function handleDeactivatePanel() {
      deactivatePanel(id);
    },
    [deactivatePanel, id]
  );

  const activePanelDragHandlePositions = useMemo(() => {
    let startWidthPx = 0;
    const totalWidthInPx =
      getPanelRenderElement().getBoundingClientRect().width;
    function percentToPx(percent: number) {
      return (percent / 100) * totalWidthInPx;
    }

    const activatePanelAsArray = Array.from(activePanels);

    const sortedActivePanelWidths = activatePanelAsArray.map((panelId) => ({
      panelId,
      width: activePanelWidths[panelId],
    }));

    return sortedActivePanelWidths.flatMap(({ panelId, width }, index) => {
      const endWidthPx = percentToPx(width) + startWidthPx;

      const res = [
        {
          elId: getPanelDragToHandleElId(panelId, 'start'),
          position: startWidthPx,
          indexToPlace: index,
        },
        {
          elId: getPanelDragToHandleElId(panelId, 'end'),
          position: endWidthPx,
          indexToPlace: index,
        },
      ];

      startWidthPx = endWidthPx;

      return res;
    });
  }, [activePanelWidths, activePanels]);

  const handleReorderStart = useCallback(() => {
    // disable all user-select
    document.body.style.userSelect = 'none';

    setIsDragging(true);
  }, []);

  const handleReorderEnd = useCallback(() => {
    if (isDragging && draggableElement.current) {
      // enable all user-select
      document.body.style.userSelect = 'auto';

      Array.from(
        document.getElementsByClassName(DRAG_TO_HANDLE_CLASSNAME)
      ).forEach((el) => {
        el.classList.remove('active-drag');
      });

      if (typeof closestElementIndex.current === 'number') {
        changePanelOrder(id, closestElementIndex.current);
      }

      setIsDragging(false);
    }
  }, [changePanelOrder, id, isDragging]);

  useEffect(() => {
    window.addEventListener('mouseup', handleReorderEnd);

    return () => {
      window.removeEventListener('mouseup', handleReorderEnd);
    };
  }, [handleReorderEnd]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging && draggableElement.current) {
        draggableElement.current.style.left = `${e.clientX}px`;
        draggableElement.current.style.top = `${e.clientY}px`;

        const relativeX =
          e.clientX - getPanelRenderElement().getBoundingClientRect().left;

        // given the activePanelDragHandlePositions find closest item to the current position

        const closestItem = activePanelDragHandlePositions.reduce(
          (acc, curr) => {
            if (
              Math.abs(curr.position - relativeX) <
              Math.abs(acc.position - relativeX)
            ) {
              return curr;
            }

            return acc;
          }
        );

        closestElementIndex.current = closestItem.indexToPlace;

        Array.from(
          document.getElementsByClassName(DRAG_TO_HANDLE_CLASSNAME)
        ).forEach(
          (el) => {
            if (el.id === closestItem.elId) {
              el.classList.add('active-drag');
            } else {
              el.classList.remove('active-drag');
            }
          },
          [closestItem]
        );
      }
    },
    [activePanelDragHandlePositions, draggableElement, isDragging]
  );

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleMouseMove]);

  return (
    <div>
      <HStack
        onMouseDown={handleReorderStart}
        id={getPanelHeaderElId(id)}
        color="background"
        align="center"
        padding="small"
        borderBottom
        justify="spaceBetween"
        className="h-panel"
      >
        <Title title={title} />
        <button
          type="button"
          onClick={handleDeactivatePanel}
          className="flex items-center"
        >
          <Cross2Icon />
          <span className="sr-only">Close</span>
        </button>
      </HStack>
      {isDragging &&
        ReactDOM.createPortal(
          <div className="fixed" ref={draggableElement}>
            <HStack
              color="background"
              className="opacity-80 h-panel whitespace-nowrap"
              align="center"
              paddingX="small"
              border
            >
              <Title title={title} />
            </HStack>
          </div>,
          document.getElementById(LETTA_DRAGGABLE_AREA_ID)!
        )}
    </div>
  );
}
