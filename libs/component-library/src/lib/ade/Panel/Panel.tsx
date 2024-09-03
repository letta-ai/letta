'use client';
import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { createContext } from 'react';
import ReactDOM from 'react-dom';
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

function usePanelManagerContext() {
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

  const activatePanel = useCallback(function activatePanel(panelId: PanelId) {
    // add the panelid to the activePanels array
    // remove any panelids that are a subset of the panelid
    // e.g. if panelId is ['a', 'b'], remove ['a', 'b', 'c'] and ['a', 'b']

    // also activate the parent panel if it is not already active

    setActivePanels((prev) => {
      return prev
        .filter((id) => {
          return !panelId.every((panelId) => id.includes(panelId));
        })
        .concat(panelId.map((v, index) => panelId.slice(0, index + 1)));
    });
  }, []);

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

interface PanelHeaderProps {
  title: string;
}

function PanelHeader(props: PanelHeaderProps) {
  const { title } = props;

  return (
    <div className="w-full flex flex-row bg-background-greyer items-center border-b space-between px-3 h-panel">
      <Typography bold>{title}</Typography>
    </div>
  );
}

type PanelContentProps = PropsWithChildren<{
  title: string;
}>;

function PanelContent(props: PanelContentProps) {
  const { title } = props;

  return (
    <div className="flex-1 h-full rounded-sm border flex flex-col">
      <PanelHeader title={title} />
      <div className="flex flex-1 bg-background">{props.children}</div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const For_storybook_use_only__PanelContent = PanelContent;

interface PanelContextData {
  id: PanelId;
}

const PanelContext = createContext<PanelContextData | undefined>(undefined);

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
      {React.cloneElement(props.trigger, {
        onClick: handleTriggerClick,
        active: isPanelActive,
      })}
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
    <div className="p-5 w-full">
      <div className="flex flex-row gap-3 h-full w-full flex-wrap">
        {Array.from(allPanels).map((panelId) => (
          <div className="contents" id={`panel-${panelId}`} key={panelId}></div>
        ))}
      </div>
    </div>
  );
}
