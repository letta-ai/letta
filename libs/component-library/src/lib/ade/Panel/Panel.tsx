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

  const activatePanel = useCallback(
    function activatePanel(panelId: PanelId) {
      // add the panelid to the activePanels array
      // remove any panelids that are a subset of the panelid
      // e.g. if panelId is ['a', 'b'], remove ['a', 'b', 'c'] and ['a', 'b']
      // if panelId is ['a', 'c'], remove ['a', 'b']

      // also activate the parent panel if it is not already active
      // remove siblings of the parent panel

      deactivatePanel(['sidebar']);

      setActivePanels((prev) => {
        const newActivePanels = prev.filter((id) => {
          return !panelId.every((panelId) => id.includes(panelId));
        });

        const parentPanelId = panelId.slice(0, panelId.length - 1);

        if (
          !newActivePanels.some(
            (id) => id.join('-') === parentPanelId.join('-')
          )
        ) {
          newActivePanels.push(parentPanelId);
        }

        return newActivePanels.concat([panelId]);
      });
    },
    [deactivatePanel]
  );

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

const panelVariants = cva('h-full rounded-sm border flex flex-col', {
  variants: {
    width: {
      compact: 'w-[400px] max-w-[400px]',
      full: 'w-full flex-1',
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
      <div className="flex flex-1 flex-col bg-background">{props.children}</div>
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
          <PanelContent {...props}>{props.children}</PanelContent>,
          // @ts-expect-error - we know this is a string
          document.getElementById(`panel-${id.join('-')}`)
        )}
    </PanelContext.Provider>
  );
}

export function PanelRenderArea() {
  const { allPanels } = usePanelManagerContext();

  return (
    <div className="w-full h-full">
      <div className="flex flex-row gap-3 h-full w-full flex-wrap">
        {Array.from(allPanels).map((panelId) => (
          <div className="contents" id={`panel-${panelId}`} key={panelId}></div>
        ))}
      </div>
    </div>
  );
}
