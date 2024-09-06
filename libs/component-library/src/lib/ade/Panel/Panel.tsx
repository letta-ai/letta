'use client';
import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { createContext } from 'react';
import ReactDOM from 'react-dom';
import { Slot } from '@radix-ui/react-slot';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { cn } from '@letta-web/core-style-config';
import { ErrorBoundary } from 'react-error-boundary';
import {
  PanelGroup as ResizablePanelGroup,
  Panel as ResizablePanel,
  PanelResizeHandle,
} from 'react-resizable-panels';
import { Logo } from '../../marketing/Logo/Logo';
import { VStack } from '../../framing/VStack/VStack';
import { Typography } from '../../core/Typography/Typography';

type PanelId = string[];

interface PanelManagerContextData {
  activePanels: PanelId[];
  allPanels: Set<string>;
  addPanel: (panelId: PanelId) => void;
  getIsPanelActive: (panelId: PanelId) => boolean;
  hasActiveSubPanel: (panelId: PanelId) => boolean;
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
  const [activePanels, setActivePanels] = React.useState<PanelId[]>([]);
  const [allPanels, setAllPanels] = React.useState<Set<string>>(new Set());
  const { children } = props;

  const hasActiveSubPanel = useCallback(
    function hasActiveSubPanel(panelId: PanelId) {
      return activePanels.some((id) =>
        panelId.every((panelId) => id.includes(panelId))
      );
    },
    [activePanels]
  );

  const deactivatePanel = useCallback(function deactivatePanel(
    panelId: PanelId
  ) {
    // remove all panelids that match the panelid or are a subset of the panelid
    // e.g. if panelId is ['a', 'b'], remove ['a', 'b', 'c'] and ['a', 'b']
    setActivePanels((prev) =>
      prev.filter((id) => {
        return !panelId.every((panelId) => id.includes(panelId));
      })
    );
  },
  []);

  const getIsPanelActive = useCallback(
    function isPanelActive(panelId: PanelId) {
      return activePanels.some((id) => id.join('-') === panelId.join('-'));
    },
    [activePanels]
  );

  const activatePanel = useCallback(function activatePanel(panelId: PanelId) {
    // add the panelid to the activePanels array
    // remove any panelids that are a subset of the panelid
    // e.g. if panelId is ['a', 'b'], remove ['a', 'b', 'c'] and ['a', 'b']
    // if panelId is ['a', 'c'], remove ['a', 'b']

    // also activate the parent panel if it is not already active
    // remove siblings of the parent panel

    setActivePanels((prev) => {
      const newActivePanels = prev.filter((id) => {
        return !panelId.every((panelId) => id.includes(panelId));
      });

      const parentPanelId = panelId.slice(0, panelId.length - 1);

      if (
        !newActivePanels.some((id) => id.join('-') === parentPanelId.join('-'))
      ) {
        newActivePanels.push(parentPanelId);
      }

      return newActivePanels.concat([panelId]);
    });
  }, []);

  const addPanel = useCallback(function addPanel(panelId: PanelId) {
    setAllPanels((prev) => {
      const newSet = new Set(prev);
      newSet.add(panelId.join('-'));
      return newSet;
    });
  }, []);

  const value = useMemo(
    () => ({
      activePanels,
      allPanels,
      getIsPanelActive,
      hasActiveSubPanel,
      activatePanel,
      deactivatePanel,
      addPanel,
    }),
    [
      activePanels,
      allPanels,
      getIsPanelActive,
      hasActiveSubPanel,
      activatePanel,
      deactivatePanel,
      addPanel,
    ]
  );

  return (
    <PanelManagerContext.Provider value={value}>
      {children}
    </PanelManagerContext.Provider>
  );
}

interface PanelContextData {
  id: PanelId;
}

const PanelContext = createContext<PanelContextData | undefined>(undefined);

export function usePanelContext() {
  const context = React.useContext(PanelContext);
  if (!context) {
    throw new Error('usePanelContext must be used within a Panel');
  }
  return context;
}

const panelVariants = cva('h-full rounded-sm border-l flex flex-col', {
  variants: {
    width: {
      compact: '',
      full: '',
    },
  },
  defaultVariants: {
    width: 'full',
  },
});

type PanelContentProps = PropsWithChildren<VariantProps<typeof panelVariants>>;

function PanelContent(props: PanelContentProps) {
  const { width } = props;

  return (
    <div className={cn(panelVariants({ width }))}>
      <div className=" flex flex-1 h-0 flex-col bg-background">
        {props.children}
      </div>
    </div>
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
  const { id, defaultOpen } = props;
  // panels must be nested within a PanelManager
  const { addPanel, deactivatePanel, activatePanel, getIsPanelActive } =
    usePanelManagerContext();

  const value = useMemo(
    () => ({
      id: id,
    }),
    [id]
  );

  useEffect(() => {
    addPanel(id);
  }, [addPanel, id]);

  useEffect(() => {
    if (defaultOpen) {
      // we need to wait for the PanelRenderArea to mount so the react-dom attachment can work
      setTimeout(() => {
        activatePanel(id);
      }, 0);
    }
  }, [activatePanel, defaultOpen, id]);

  const isPanelActive = useMemo(
    () => getIsPanelActive(id),
    [getIsPanelActive, id]
  );

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
        isActive={isPanelActive}
      >
        {props.trigger}
      </Slot>

      {isPanelActive &&
        ReactDOM.createPortal(
          <ErrorBoundary
            fallbackRender={function FallbackComponent() {
              return <div>Something went wrong</div>;
            }}
          >
            <PanelContent {...props} />
          </ErrorBoundary>,
          // @ts-expect-error - we know this is a string
          document.getElementById(`panel-${id.join('-')}`)
        )}
    </PanelContext.Provider>
  );
}

interface PanelRenderAreaProps {
  initialPositions?: string[];
}

export function PanelRenderArea(props: PanelRenderAreaProps) {
  const { allPanels, activePanels } = usePanelManagerContext();
  const [positions] = React.useState(props.initialPositions || []);

  // order panels by given positions, all other panels will be rendered at the end

  const panelsOrdered = useMemo(
    () =>
      Array.from(allPanels).sort((a, b) => {
        const parentA = a.split('-')[0];
        const parentB = b.split('-')[0];

        const positionA = positions.indexOf(parentA);
        const positionB = positions.indexOf(parentB);

        if (positionA > positionB) return -1;
        if (positionA < positionB) return 1;

        return 0;
      }),
    [allPanels, positions]
  );

  const activePanelSet = useMemo(() => {
    return new Set(
      activePanels.map((panelId) => panelId.join('-')).filter(Boolean)
    );
  }, [activePanels]);

  return (
    <>
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
      <ResizablePanelGroup className="relative z-[1]" direction="horizontal">
        {panelsOrdered.map((panelId) => (
          <>
            <ResizablePanel
              defaultSize={300}
              hidden={!activePanelSet.has(panelId)}
              key={panelId}
            >
              <div
                className="contents"
                id={`panel-${panelId}`}
                key={panelId}
              ></div>
            </ResizablePanel>
            <PanelResizeHandle />
          </>
        ))}
      </ResizablePanelGroup>
    </>
  );
}

interface PanelPageProps {
  header: React.ReactNode;
  bar?: React.ReactNode;
}

export function PanelPage(props: PropsWithChildren<PanelPageProps>) {
  const { header, bar, children } = props;

  return (
    <VStack collapseHeight fullWidth fullHeight gap={false}>
      {header}
      {bar}
      <VStack collapseHeight fullWidth fullHeight gap={false}>
        {children}
      </VStack>
    </VStack>
  );
}
