'use client';
import type { PropsWithChildren } from 'react';
import { useEffect, useRef } from 'react';
import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { createContext } from 'react';
import ReactDOM from 'react-dom';
import { Slot } from '@radix-ui/react-slot';
import { ErrorBoundary } from 'react-error-boundary';

import { Logo } from '../../marketing/Logo/Logo';
import { VStack } from '../../framing/VStack/VStack';
import { Typography } from '../../core/Typography/Typography';
import { useLocalStorage } from '@mantine/hooks';
import { Frame } from '../../framing/Frame/Frame';
import { HStack } from '../../framing/HStack/HStack';
import { PanelHeader } from '../PanelHeader/PanelHeader';
import { cn } from '@letta-web/core-style-config';
import './Panel.scss';

type PanelId = string;

interface PanelManagerContextData {
  activePanels: Set<PanelId>;
  setPanelWidth: (panelId: PanelId, width: number) => void;
  changePanelOrder: (panelId: PanelId, index: number) => void;
  activePanelWidths: Record<PanelId, number>;
  getIsPanelActive: (panelId: PanelId) => boolean;
  activatePanel: (panelId: PanelId) => void;
  deactivatePanel: (panelId: PanelId) => void;
}

const PanelManagerContext = createContext<PanelManagerContextData | undefined>(
  undefined
);

export function usePanelManagerContext() {
  const context = React.useContext(PanelManagerContext);
  if (!context) {
    throw new Error(
      'usePanelManagerContext must be used within a PanelProvider'
    );
  }
  return context;
}

type PanelManagerProps = PropsWithChildren<Record<never, string>>;

export function PanelManager(props: PanelManagerProps) {
  const [activePanels, setActivePanels] = useLocalStorage<Set<PanelId>>({
    defaultValue: new Set(),
    deserialize: (value) => {
      if (!value) return new Set();

      return new Set(value.split(','));
    },
    serialize: (value) => Array.from(value).join(','),
    key: 'panel-manager-active-panels',
  });

  const activePanelsAsArray = useMemo(() => {
    return Array.from(activePanels);
  }, [activePanels]);

  const [activePanelWidths, setActivePanelWidths] = useLocalStorage<
    Record<PanelId, number>
  >({
    defaultValue: {},
    key: 'panel-manager-active-panel-widths',
  });

  const changePanelOrder = useCallback(
    function changePanelOrder(panelId: PanelId, index: number) {
      setActivePanels((prev) => {
        const newActivePanels = new Set(prev);
        const activePanelIds = Array.from(newActivePanels);
        const currentIndex = activePanelIds.indexOf(panelId);

        if (currentIndex === -1) {
          return prev;
        }

        // handle the index being out of bounds
        if (index < 0) {
          index = 0;
        } else if (index >= activePanelIds.length) {
          index = activePanelIds.length - 1;
        }

        // remove the panel from the current index
        activePanelIds.splice(currentIndex, 1);

        // insert the panel at the new index
        activePanelIds.splice(index, 0, panelId);

        return new Set(activePanelIds);
      });
    },
    [setActivePanels]
  );

  const handleSetPanelWidth = useCallback(
    function setPanelWidth(panelId: PanelId, desiredWidth: number) {
      const totalWidthInPx =
        getPanelRenderElement().getBoundingClientRect().width;

      // desiredWidth is a percentage
      // panels are in order of appearance, so to set the desiredWidth of one panel, we reduce the size of the next panel over, if the panelId is the last panel, we don't need to do anything
      setActivePanelWidths((prev) => {
        const newActivePanelWidths = { ...prev };
        const currentPanelIndex = activePanelsAsArray.indexOf(panelId);
        const nextPanelId = activePanelsAsArray[currentPanelIndex + 1];

        if (!nextPanelId) {
          return prev;
        }

        const currentPanelWidth = newActivePanelWidths[panelId];
        const neighbourPanelWidth = newActivePanelWidths[nextPanelId];

        // total width of all the panels in % excluding the current panel
        const amountToReduce = desiredWidth - currentPanelWidth;
        const neighbourPanelNewWidth = neighbourPanelWidth - amountToReduce;

        const neighbourPanelNewWidthInPx =
          (neighbourPanelNewWidth / 100) * totalWidthInPx;

        // the desired width cannot be less than 200px or the nextPanelCurrentWidth cannot be less than 200px
        // first convert the percentage to px
        const desiredWidthInPx = (desiredWidth / 100) * totalWidthInPx;

        if (desiredWidthInPx < 200 || neighbourPanelNewWidthInPx < 200) {
          return prev;
        }

        newActivePanelWidths[nextPanelId] = neighbourPanelNewWidth;
        newActivePanelWidths[panelId] = desiredWidth;

        return newActivePanelWidths;
      });
    },
    [activePanelsAsArray, setActivePanelWidths]
  );

  const { children } = props;

  const deactivatePanel = useCallback(
    function deactivatePanel(panelId: PanelId) {
      setActivePanels((prev) => {
        const newActivePanels = new Set(prev);
        newActivePanels.delete(panelId);

        setActivePanelWidths((prevPanelWidth) => {
          // reset all panel widths to equal each other
          const newActivePanelWidths = { ...prevPanelWidth };
          const activePanelIds = Array.from(newActivePanels);
          const width = 100 / activePanelIds.length;

          activePanelIds.forEach((id) => {
            newActivePanelWidths[id] = width;
          });

          return newActivePanelWidths;
        });

        return newActivePanels;
      });
    },
    [setActivePanelWidths, setActivePanels]
  );

  const getIsPanelActive = useCallback(
    function isPanelActive(panelId: PanelId) {
      return activePanels.has(panelId);
    },
    [activePanels]
  );

  const activatePanel = useCallback(
    function activatePanel(panelId: PanelId) {
      setActivePanels((prev) => {
        const newActivePanels = new Set(prev);
        newActivePanels.add(panelId);

        setActivePanelWidths((prev) => {
          // reset all panel widths to equal each other
          const newActivePanelWidths = { ...prev };
          const activePanelIds = Array.from(newActivePanels);
          const width = 100 / activePanelIds.length;

          activePanelIds.forEach((id) => {
            newActivePanelWidths[id] = width;
          });

          return newActivePanelWidths;
        });

        return newActivePanels;
      });
    },
    [setActivePanelWidths, setActivePanels]
  );

  const value = useMemo(
    () => ({
      activePanels,
      getIsPanelActive,
      changePanelOrder,
      activatePanel,
      setPanelWidth: handleSetPanelWidth,
      activePanelWidths,
      deactivatePanel,
    }),
    [
      activePanels,
      getIsPanelActive,
      changePanelOrder,
      activatePanel,
      handleSetPanelWidth,
      activePanelWidths,
      deactivatePanel,
    ]
  );

  return (
    <PanelManagerContext.Provider value={value}>
      {children}
    </PanelManagerContext.Provider>
  );
}

export function getPanelElId(panelId: PanelId) {
  return `panel-${panelId}`;
}

export function getPanelHeaderElId(panelId: PanelId) {
  return `panel-header-${panelId}`;
}

export function getPanelDragToHandleElId(
  panelId: PanelId,
  type: 'end' | 'start'
) {
  return `panel-drag-to-handle-${panelId}-${type}`;
}

export function getPanelRenderElement() {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return document.getElementById('letta-web-panel-render-area')!;
}

interface PanelContextData {
  id: PanelId;
  isPanelActive: boolean;
}

const PanelContext = createContext<PanelContextData | undefined>(undefined);

export function usePanelContext() {
  const context = React.useContext(PanelContext);
  if (!context) {
    throw new Error('usePanelContext must be used within a Panel');
  }
  return context;
}

interface ResizeHandleProps {
  panelId: PanelId;
}

function ResizeHandle(props: ResizeHandleProps) {
  const { panelId } = props;
  const { setPanelWidth } = usePanelManagerContext();
  const isDragging = useRef(false);

  const handleStartDrag = useCallback(() => {
    isDragging.current = true;
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    function handleEndDrag() {
      isDragging.current = false;
      document.body.style.userSelect = 'auto';
      document.body.style.cursor = 'auto';
    }

    window.addEventListener('mouseup', handleEndDrag);

    return () => {
      window.removeEventListener('mouseup', handleEndDrag);
    };
  }, []);

  const handleSetWidth = useCallback(
    (event: MouseEvent) => {
      if (!isDragging.current) {
        return;
      }

      const { width } = getPanelRenderElement().getBoundingClientRect();

      const panelLeft = document
        .getElementById(getPanelElId(panelId))
        ?.getBoundingClientRect().left;

      if (!panelLeft) {
        throw new Error('Panel not found');
      }

      const nextWidth = ((event.clientX - panelLeft) / width) * 100;

      setPanelWidth(panelId, nextWidth);
    },
    [panelId, setPanelWidth]
  );

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      handleSetWidth(event);
    }

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleSetWidth]);

  return (
    <Frame
      onMouseDown={handleStartDrag}
      color="background-grey"
      fullHeight
      className="absolute right-0 top-0 w-[1px] cursor-ew-resize"
    />
  );
}

interface DragToHandleProps {
  id: PanelId;
  type: 'end' | 'start';
}

export const DRAG_TO_HANDLE_CLASSNAME = 'drag-to-handle';

function DragToHandle(props: DragToHandleProps) {
  const { id, type } = props;

  return (
    <div
      id={getPanelDragToHandleElId(id, type)}
      className={cn(
        DRAG_TO_HANDLE_CLASSNAME,
        type === 'start' ? 'left-0' : 'right-0',
        'absolute pointer-events-none top-0 bg-transparent opacity-20 w-[2px] h-full  z-[2]'
      )}
    />
  );
}

type PanelContentProps = PropsWithChildren<{
  id: PanelId;
  title?: string;
}>;

function PanelContent(props: PanelContentProps) {
  const { children, id, title } = props;
  const { activePanelWidths, activePanels } = usePanelManagerContext();
  const mounted = useRef(false);

  const panelWidth = useMemo(() => {
    return activePanelWidths[id];
  }, [activePanelWidths, id]);

  useEffect(() => {
    // sort the panels by their order of appearance on mount
    const activePanelIds = Array.from(activePanels);
    const allChildren = getPanelRenderElement().children;

    const sortedChildren = Array.from(allChildren).sort((a, b) => {
      return (
        activePanelIds.indexOf(a.id.replace('panel-', '')) -
        activePanelIds.indexOf(b.id.replace('panel-', ''))
      );
    });

    getPanelRenderElement().innerHTML = '';
    sortedChildren.forEach((child) => {
      getPanelRenderElement().appendChild(child);
    });

    mounted.current = true;
  }, [activePanels]);

  return (
    <HStack
      id={getPanelElId(id)}
      data-testid={`panel-${id}`}
      fullHeight
      color="background"
      border
      style={{ width: `${panelWidth}%` }}
      className="relative"
    >
      <DragToHandle id={id} type="start" />
      <ErrorBoundary
        fallbackRender={function FallbackComponent() {
          return <div>Something went wrong</div>;
        }}
      >
        {title ? (
          <PanelPage header={<PanelHeader title={title} />}>
            {children}
          </PanelPage>
        ) : (
          children
        )}
      </ErrorBoundary>
      <DragToHandle id={id} type="end" />
      <ResizeHandle panelId={id} />
    </HStack>
  );
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const For_storybook_use_only__PanelContent = PanelContent;

type PanelProps = PanelContentProps &
  PropsWithChildren<{
    id: PanelId;
    defaultOpen?: boolean;
    trigger: React.ReactElement;
  }>;

export function Panel(props: PanelProps) {
  const { id, defaultOpen, children } = props;
  // panels must be nested within a PanelManager
  const { deactivatePanel, activatePanel, getIsPanelActive } =
    usePanelManagerContext();

  const isPanelActive = useMemo(
    () => getIsPanelActive(id),
    [getIsPanelActive, id]
  );

  const value = useMemo(
    () => ({
      id: id,
      isPanelActive,
    }),
    [id, isPanelActive]
  );

  useEffect(() => {
    if (defaultOpen) {
      activatePanel(id);
    }
  }, [activatePanel, defaultOpen, id]);

  const handleTriggerClick = useCallback(
    function handleTriggerClick() {
      if (!isPanelActive) {
        activatePanel(id);
      } else {
        deactivatePanel(id);
      }
    },
    [id, isPanelActive, activatePanel, deactivatePanel]
  );

  return (
    <PanelContext.Provider value={value}>
      <Slot
        onClick={handleTriggerClick}
        // @ts-expect-error - this is allowed
        active={isPanelActive}
      >
        {props.trigger}
      </Slot>
      {isPanelActive &&
        ReactDOM.createPortal(
          <PanelContent title={props.title} id={id}>
            {children}
          </PanelContent>,
          getPanelRenderElement()
        )}
    </PanelContext.Provider>
  );
}

export const LETTA_DRAGGABLE_AREA_ID = 'letta-web-draggable-area';

export function PanelRenderArea() {
  return (
    <Frame position="relative" fullWidth fullHeight>
      <VStack
        gap="large"
        fullWidth
        fullHeight
        align="center"
        justify="center"
        className="absolute z-0"
      >
        <Logo color="muted" size="large" />
        <Typography bold color="muted">
          No panels open
        </Typography>
      </VStack>
      <div
        id="letta-web-panel-render-area"
        className="relative w-full z-[1] flex flex-row h-full"
      ></div>
      <div
        id={LETTA_DRAGGABLE_AREA_ID}
        className="absolute w-[0] h-[0] top-0 left-0  z-[2]"
      ></div>
    </Frame>
  );
}

export type PanelPageChildrenType = React.ReactNode;

export interface PanelPageProps {
  header: React.ReactNode;
  children: PanelPageChildrenType;
}

export function PanelPage(props: PanelPageProps) {
  const { header, children } = props;

  return (
    <VStack fullHeight fullWidth gap={false}>
      {header}
      <VStack collapseHeight fullWidth fullHeight gap={false}>
        {children}
      </VStack>
    </VStack>
  );
}
