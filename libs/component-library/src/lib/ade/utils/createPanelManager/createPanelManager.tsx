'use client';
import type { ZodSchema } from 'zod';
import { z } from 'zod';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Slot } from '@radix-ui/react-slot';
import { HStack } from '../../../framing/HStack/HStack';
import { VStack } from '../../../framing/VStack/VStack';
import { createPortal } from 'react-dom';
import { cn } from '@letta-web/core-style-config';
import './CreatePanelManager.css';
import { Frame } from '../../../framing/Frame/Frame';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  useDndContext,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  GenericPanelContent,
  GenericPanelTabBar,
  GenericTab,
  GenericTabRenderer,
} from '../../_internal/Panel/Panel';
import * as Sentry from '@sentry/nextjs';

export type GenericPanelTemplateId = number | string | symbol;

export interface PanelTemplate<
  TPanelTemplateId extends GenericPanelTemplateId
> {
  noTab?: boolean;
  templateId: TPanelTemplateId;
  useGetTitle: (data?: ZodSchema['_output']) => string;
  data: ZodSchema;
  content: React.ComponentType<ZodSchema['_output']>;
}

type PanelTemplateRegistry<TPanelTemplateId extends GenericPanelTemplateId> =
  Record<TPanelTemplateId, PanelTemplate<TPanelTemplateId>>;

type PanelPosition = [number, number, number];

interface PanelPositionItem<TPanelTemplateId extends GenericPanelTemplateId> {
  id: string;
  templateId: TPanelTemplateId;
  data: PanelTemplate<TPanelTemplateId>['data']['_output'];
  isActive: boolean;
}

export interface PanelDimensionType<TPositions> {
  size: number;
  positions: TPositions;
}

// panels exist in a three dimensional space
// the first dimension is the x axis
// the second dimension is the y axis
// the third dimension is the tab
export type PanelItemTabsPositions<
  TPanelTemplateId extends GenericPanelTemplateId
> = PanelDimensionType<Array<PanelPositionItem<TPanelTemplateId>>>;

export type PanelItemYPositions<
  TPanelTemplateId extends GenericPanelTemplateId
> = PanelDimensionType<Array<PanelItemTabsPositions<TPanelTemplateId>>>;

export type PanelItemPositionsMatrix<
  TPanelTemplateId extends GenericPanelTemplateId
> = Array<PanelItemYPositions<TPanelTemplateId>>;

export function createPanelManager<
  TPanelTemplateId extends GenericPanelTemplateId,
  TPanelRegistry extends PanelTemplateRegistry<TPanelTemplateId>
>(panelRegistry: TPanelRegistry) {
  interface PanelManagerContextProps {
    children: React.ReactNode;
  }

  function isDataTabData(
    data: unknown
  ): data is PanelPositionItem<RegisteredPanelTemplateId> {
    return Object.prototype.hasOwnProperty.call(data, 'templateId');
  }

  function DragAndDropOverlay() {
    const { active } = useDndContext();

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      setMounted(true);
    }, []);

    return (
      mounted &&
      createPortal(
        <DragOverlay>
          {active && isDataTabData(active.data.current) && (
            <Tab tab={active.data.current} isActive={false} x={0} y={0} />
          )}
        </DragOverlay>,
        document.body
      )
    );
  }

  function DragAndDropContext(props: PanelManagerContextProps) {
    const { movePanelToPosition } = usePanelManager();

    const pointerSensor = useSensor(PointerSensor, {
      activationConstraint: {
        distance: 1,
      },
    });
    const mouseSensor = useSensor(MouseSensor);
    const touchSensor = useSensor(TouchSensor);
    const keyboardSensor = useSensor(KeyboardSensor);

    const sensors = useSensors(
      mouseSensor,
      touchSensor,
      keyboardSensor,
      pointerSensor
    );

    function handleDragEnd(event: DragEndEvent) {
      if (event.active && isDataTabData(event.active.data.current)) {
        const dropData = MoveToConfigSchema.safeParse(event.over?.data.current);

        if (!dropData.success) {
          return;
        }

        const { x, y, tab } = dropData.data;

        movePanelToPosition(event.active.data.current.id, [x, y, tab]);
      }
    }

    return (
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {props.children}
        <DragAndDropOverlay />
      </DndContext>
    );
  }

  type RegisteredPanelTemplateId = keyof typeof panelRegistry;
  type ExtractPanelData<TPanelTemplateId extends RegisteredPanelTemplateId> =
    (typeof panelRegistry)[TPanelTemplateId]['data']['_output'];
  type RegisteredPanelItemPositionsMatrix =
    PanelItemPositionsMatrix<RegisteredPanelTemplateId>;
  type PanelId = string;

  interface OpenPanelOptions<
    TPanelTemplateId extends RegisteredPanelTemplateId
  > {
    id: PanelId;
    templateId: TPanelTemplateId;
    data: ExtractPanelData<TPanelTemplateId>;
  }

  interface PanelManagerContextDataType {
    positions: PanelItemPositionsMatrix<RegisteredPanelTemplateId>;
    resizeX: (x: number, size: number) => void;
    resizeY: (x: number, y: number, size: number) => void;
    getIsPanelTemplateActive: (
      panelTemplateId: RegisteredPanelTemplateId
    ) => boolean;
    setPositions: (positions: RegisteredPanelItemPositionsMatrix) => void;
    openPanel: <TPanelTemplateId extends RegisteredPanelTemplateId>(
      options: OpenPanelOptions<TPanelTemplateId>
    ) => void;
    activatePanel: (panelId: PanelId) => void;
    closePanel: (panelId: PanelId) => void;
    movePanelToPosition: (panelId: PanelId, position: PanelPosition) => void;
    panelIdToPositionMap: Record<PanelId, PanelPosition>;
    getIsPanelIdActive: (panelId: PanelId) => boolean;
    getIsPanelIdExists: (panelId: PanelId) => boolean;
  }

  const PanelManagerContext = createContext<PanelManagerContextDataType>({
    positions: [],
    resizeX: () => {
      return false;
    },
    resizeY: () => {
      return false;
    },
    setPositions: () => {
      return;
    },
    getIsPanelTemplateActive: () => false,
    panelIdToPositionMap: {},
    activatePanel: () => {
      return;
    },
    openPanel: () => {
      return false;
    },
    closePanel: () => {
      return false;
    },
    movePanelToPosition: () => {
      return false;
    },
    getIsPanelIdActive: () => false,
    getIsPanelIdExists: () => false,
  });

  interface PanelManagerProps {
    children: React.ReactNode;
    onPositionError: () => void;
    fallbackPositions: RegisteredPanelItemPositionsMatrix;
    initialPositions?: RegisteredPanelItemPositionsMatrix;
    onPositionChange?: (positions: RegisteredPanelItemPositionsMatrix) => void;
  }

  interface PanelState {
    positions: RegisteredPanelItemPositionsMatrix;
    panelIdToPositionMap: Record<PanelId, PanelPosition>;
    activePanelTemplates: Set<RegisteredPanelTemplateId>;
  }

  function PanelManagerProvider(props: PanelManagerProps) {
    const {
      children,
      onPositionError,
      fallbackPositions,
      initialPositions = [],
      onPositionChange,
    } = props;

    const reconcilePositions = useCallback(
      (positions: RegisteredPanelItemPositionsMatrix) => {
        // should remove any empty positions, as in positions with no panels
        const xPositions = [...positions];

        // loop through and remove duplicate ids, start from reverse to avoid index issues
        const activeIds = new Set<PanelId>();

        for (let x = xPositions.length - 1; x >= 0; x--) {
          const yPositions = xPositions[x]?.positions;

          if (!yPositions) {
            xPositions.splice(x, 1);
            continue;
          }

          for (let y = yPositions.length - 1; y >= 0; y--) {
            const tabPositions = yPositions[y]?.positions;

            if (!tabPositions) {
              yPositions.splice(y, 1);
              continue;
            }

            for (let tab = tabPositions.length - 1; tab >= 0; tab--) {
              const panelPosition = tabPositions[tab];

              if (!panelPosition) {
                tabPositions.splice(tab, 1);
                continue;
              }

              if (activeIds.has(panelPosition.id)) {
                tabPositions.splice(tab, 1);
              } else {
                activeIds.add(panelPosition.id);
              }
            }

            if (tabPositions.length === 0) {
              yPositions.splice(y, 1);
            }
          }

          if (yPositions.length === 0) {
            xPositions.splice(x, 1);
          }
        }

        // loop through the x, y and tab positions and remove any empty arrays
        // start from reverse to avoid index issues
        for (let x = xPositions.length - 1; x >= 0; x--) {
          const yPositions = xPositions[x]?.positions;

          if (!yPositions || yPositions.length === 0) {
            xPositions.splice(x, 1);
            continue;
          }

          for (let y = yPositions.length - 1; y >= 0; y--) {
            const tabPositions = yPositions[y].positions;

            if (!tabPositions || tabPositions.length === 0) {
              yPositions.splice(y, 1);
              continue;
            }

            for (let tab = tabPositions.length - 1; tab >= 0; tab--) {
              const panelPosition = tabPositions[tab];

              if (!panelPosition || !panelRegistry[panelPosition.templateId]) {
                tabPositions.splice(tab, 1);
              }
            }

            if (tabPositions.length === 0) {
              yPositions.splice(y, 1);
            }
          }

          if (yPositions.length === 0) {
            xPositions.splice(x, 1);
          }
        }

        const panelIdToPositionMap: Record<PanelId, PanelPosition> = {};

        positions.forEach((yPositions, x) => {
          yPositions?.positions?.forEach((tabPositions, y) => {
            tabPositions?.positions?.forEach((panelPosition, tab) => {
              panelIdToPositionMap[panelPosition.id] = [x, y, tab];
            });
          });
        });

        const activePanelTemplates = new Set<RegisteredPanelTemplateId>();

        positions.forEach((yPositions) => {
          yPositions?.positions?.forEach((tabPositions) => {
            const firstActivePanel = tabPositions.positions.find(
              (panel) => panel.isActive
            );

            tabPositions?.positions?.forEach((panel) => {
              activePanelTemplates.add(panel.templateId);
            });

            if (!firstActivePanel) {
              tabPositions.positions[0].isActive = true;
            }
          });
        });

        // loop through all x and ys and make sure sizes add up to 100 per dimension
        const totalX = xPositions.reduce((acc, x) => acc + x.size, 0);

        xPositions.forEach((x) => {
          const totalY = x.positions.reduce((acc, y) => acc + y.size, 0);

          x.size = (x.size / totalX) * 100;

          x.positions.forEach((y) => {
            y.size = (y.size / totalY) * 100;
          });
        }, 0);

        return {
          positions: xPositions,
          activePanelTemplates,
          panelIdToPositionMap,
        };
      },
      []
    );

    const [state, setState] = useState<PanelState>(() => {
      return reconcilePositions(initialPositions);
    });

    useEffect(() => {
      if (onPositionChange) {
        onPositionChange(state.positions);
      }
    }, [onPositionChange, state.positions]);

    const MIN_WIDTH = 250;

    const resizeX = useCallback(
      (x: number, size: number) => {
        const totalWidthInPx =
          getPanelRenderElement().getBoundingClientRect().width;

        setState((prevState) => {
          const nextState = reconcilePositions(prevState.positions);

          const currentPanelWidth = nextState.positions[x].size;
          const neighbourPanelWidth = nextState.positions[x + 1].size;

          // total width of all the panels in % excluding the current panel
          const amountToReduce = size - currentPanelWidth;
          const neighbourPanelNewWidth = neighbourPanelWidth - amountToReduce;

          const neighbourPanelNewWidthInPx =
            (neighbourPanelNewWidth / 100) * totalWidthInPx;

          // the desired width cannot be less than 200px or the nextPanelCurrentWidth cannot be less than 200px
          // first convert the percentage to px
          const desiredWidthInPx = (size / 100) * totalWidthInPx;

          if (
            desiredWidthInPx < MIN_WIDTH ||
            neighbourPanelNewWidthInPx < MIN_WIDTH
          ) {
            return prevState;
          }

          nextState.positions[x + 1].size = neighbourPanelNewWidth;
          nextState.positions[x].size = size;

          return nextState;
        });
      },
      [reconcilePositions]
    );

    const resizeY = useCallback((x: number, y: number, size: number) => {
      const totalWidthInPx =
        getPanelRenderElement().getBoundingClientRect().width;

      setState((prevState) => {
        const nextState = { ...prevState };

        const currentPanelHeight = nextState.positions[x].positions[y].size;
        const neighbourPanelHeight =
          nextState.positions[x].positions[y + 1].size;

        // total height of all the panels in % excluding the current panel
        const amountToReduce = size - currentPanelHeight;
        const neighbourPanelNewHeight = neighbourPanelHeight - amountToReduce;

        const neighbourPanelNewHeightInPx =
          (neighbourPanelNewHeight / 100) * totalWidthInPx;

        // the desired height cannot be less than 200px or the nextPanelCurrentHeight cannot be less than 200px
        // first convert the percentage to px
        const desiredHeightInPx = (size / 100) * totalWidthInPx;

        if (desiredHeightInPx < 200 || neighbourPanelNewHeightInPx < 200) {
          return prevState;
        }

        nextState.positions[x].positions[y + 1].size = neighbourPanelNewHeight;
        nextState.positions[x].positions[y].size = size;

        return nextState;
      });
    }, []);

    const openPanel = useCallback(
      (options: OpenPanelOptions<RegisteredPanelTemplateId>) => {
        // adds a panel next to the first active panel it finds
        // otherwise adds the panel to [0, 0, 0]
        // always make this panel active

        const { id, templateId, data } = options;

        setState((prevState) => {
          if (prevState.panelIdToPositionMap[id]) {
            const { positions: nextState, panelIdToPositionMap } =
              reconcilePositions(prevState.positions);

            // set the panel to active
            const position = panelIdToPositionMap[id];

            if (!position) {
              return prevState;
            }

            const [x, y, tab] = position;

            nextState[x].positions[y].positions.forEach((panel, tabIdx) => {
              panel.isActive = tabIdx === tab;
            });

            return reconcilePositions(nextState);
          }

          const hasNoTabPanelOpenInFirstXPosition =
            panelRegistry?.[
              prevState.positions[0]?.positions[0]?.positions[0]?.templateId
            ]?.noTab;

          const firstXIndex = hasNoTabPanelOpenInFirstXPosition ? 1 : 0;

          const panelPayload: PanelPositionItem<RegisteredPanelTemplateId> = {
            id,
            templateId,
            data,
            isActive: true,
          };

          const { positions: nextState } = reconcilePositions(
            prevState.positions
          );

          if (!nextState[firstXIndex]) {
            nextState[firstXIndex] = {
              size: 100,
              positions: [],
            };
          }

          if (!nextState[firstXIndex].positions[0]) {
            nextState[firstXIndex].positions[0] = {
              size: 100,
              positions: [],
            };
          }

          if (!nextState[firstXIndex].positions[0].positions[0]) {
            nextState[firstXIndex].positions[0].positions[0] = panelPayload;
          } else {
            const firstActivePanel = nextState[
              firstXIndex
            ].positions[0].positions.find((panel) => panel.isActive);

            if (firstActivePanel) {
              const firstActivePanelIndex =
                nextState[firstXIndex].positions[0].positions.indexOf(
                  firstActivePanel
                );

              nextState[firstXIndex].positions[0].positions[
                firstActivePanelIndex
              ] = {
                ...nextState[firstXIndex].positions[0].positions[
                  firstActivePanelIndex
                ],
                isActive: false,
              };

              nextState[firstXIndex].positions[0].positions.splice(
                firstActivePanelIndex + 1,
                0,
                panelPayload
              );
            } else {
              nextState[firstXIndex].positions[0].positions.push(panelPayload);
            }
          }

          return reconcilePositions(nextState);
        });
      },
      [reconcilePositions]
    );

    const closePanel = useCallback(
      (panelId: PanelId) => {
        setState((prevState) => {
          const {
            positions: nextState,
            panelIdToPositionMap: nextPositionMap,
          } = reconcilePositions(prevState.positions);

          const position = nextPositionMap[panelId];

          if (!position) {
            return prevState;
          }

          const [x, y, tab] = position;

          nextState[x].positions[y].positions.splice(tab, 1);

          return reconcilePositions(nextState);
        });
      },
      [reconcilePositions]
    );

    const activatePanel = useCallback(
      (panelId: PanelId) => {
        // should make the panel active, make all other panels within tab group inactive

        setState((prevState) => {
          try {
            const { positions: nextPositions } = reconcilePositions(
              prevState.positions
            );

            const position = prevState.panelIdToPositionMap[panelId];

            if (!position) {
              return prevState;
            }

            const [x, y, tab] = position;

            nextPositions[x].positions[y].positions.forEach((panel, tabIdx) => {
              panel.isActive = tabIdx === tab;
            });

            return reconcilePositions(nextPositions);
          } catch (e) {
            Sentry.captureException(e);
            onPositionError();
            return reconcilePositions(fallbackPositions);
          }
        });
      },
      [fallbackPositions, onPositionError, reconcilePositions]
    );

    const movePanelToPosition = useCallback(
      (panelId: PanelId, nextPosition: PanelPosition) => {
        try {
          // given a panelId, move the panel to the given nextPosition,
          // if the nextPosition is invalid, move the panel to the first available nextPosition
          // if the panel is already in the given nextPosition, do nothing

          setState((prevState) => {
            const { positions: nextState, panelIdToPositionMap } =
              reconcilePositions(prevState.positions);

            const [nextX, nextY, tab] = nextPosition;

            const foundPanelPosition = panelIdToPositionMap[panelId];

            // if we cant find the panel, this is an invalid operation
            if (!foundPanelPosition) {
              return prevState;
            }

            // if the panel is already in the given position, do nothing
            if (
              foundPanelPosition[0] === nextX &&
              foundPanelPosition[1] === nextY &&
              foundPanelPosition[2] === tab
            ) {
              return prevState;
            }

            const [currentX, currentY, currentTab] = foundPanelPosition;

            if (
              !nextState[currentX]?.positions[currentY]?.positions[currentTab]
            ) {
              return prevState;
            }

            const panelToMove = {
              ...nextState[currentX].positions[currentY].positions[currentTab],
            };

            // add panel to new position
            if (!nextState[nextX]) {
              nextState[nextX] = {
                size: 100,
                positions: [],
              };
            }

            if (!nextState[nextX].positions[nextY]) {
              nextState[nextX].positions[nextY] = {
                size: 100,
                positions: [],
              };
            }

            // if a tab already exists at the given position, move the panel next to it
            // if tab is -1 move it to become the first tab
            if (tab === -1) {
              nextState[nextX].positions[nextY].positions.splice(
                0,
                0,
                panelToMove
              );
            } else if (nextState[nextX].positions[nextY].positions[tab]) {
              nextState[nextX].positions[nextY].positions.splice(
                tab + 1,
                0,
                panelToMove
              );
            } else {
              nextState[nextX].positions[nextY].positions.splice(
                tab,
                0,
                panelToMove
              );
            }

            nextState[nextX].positions[nextY].positions = nextState[
              nextX
            ].positions[nextY].positions.map((panel) => {
              return {
                ...panel,
                isActive: panel.id === panelId,
              };
            });

            if (currentX === nextX && currentY === nextY) {
              // if panel is moved within the same tab group, remove the panel from the old position
              // account that if the tab was moved to the right, we remove the first instance of the panel
              // if the tab was moved to the left, we remove the second instance of the panel

              const movedLeft = currentTab > tab;

              if (movedLeft) {
                nextState[currentX].positions[currentY].positions.splice(
                  currentTab + 1,
                  1
                );
              } else {
                nextState[currentX].positions[currentY].positions.splice(
                  currentTab,
                  1
                );
              }
            } else {
              nextState[currentX].positions[currentY].positions.splice(
                currentTab,
                1
              );
            }

            return reconcilePositions(nextState);
          });
        } catch (e) {
          Sentry.captureException(e);
          onPositionError();
          setState(reconcilePositions(fallbackPositions));
        }
      },
      [fallbackPositions, onPositionError, reconcilePositions]
    );

    const getIsPanelTemplateActive = useCallback(
      (panelTemplateId: RegisteredPanelTemplateId) => {
        return state.activePanelTemplates.has(panelTemplateId);
      },
      [state]
    );

    const getIsPanelIdExists = useCallback(
      (panelId: PanelId) => {
        return Boolean(state.panelIdToPositionMap[panelId]);
      },
      [state.panelIdToPositionMap]
    );

    const getIsPanelIdActive = useCallback(
      (panelId: PanelId) => {
        const positions = reconcilePositions(state.positions)
          .panelIdToPositionMap[panelId];

        if (!positions) {
          return false;
        }

        const [x, y, tab] = positions;

        return state.positions[x].positions[y].positions[tab].isActive;
      },
      [reconcilePositions, state.positions]
    );

    const setPositions = useCallback(
      (positions: RegisteredPanelItemPositionsMatrix) => {
        setState(reconcilePositions(positions));
      },
      [reconcilePositions]
    );

    const value = useMemo(() => {
      return {
        getIsPanelTemplateActive,
        panelIdToPositionMap: state.panelIdToPositionMap,
        getIsPanelIdActive,
        positions: state.positions,
        openPanel,
        closePanel,
        activatePanel,
        movePanelToPosition,
        setPositions,
        getIsPanelIdExists,
        resizeX,
        resizeY,
      };
    }, [
      getIsPanelTemplateActive,
      state.panelIdToPositionMap,
      getIsPanelIdActive,
      state.positions,
      setPositions,
      openPanel,
      closePanel,
      activatePanel,
      getIsPanelIdExists,
      movePanelToPosition,
      resizeX,
      resizeY,
    ]);

    return (
      <PanelManagerContext.Provider value={value}>
        <DragAndDropContext>{children}</DragAndDropContext>
      </PanelManagerContext.Provider>
    );
  }

  interface PanelTabDraggerProps {
    children: React.ReactNode;
    tab: PanelPositionItem<RegisteredPanelTemplateId>;
    x: number;
    y: number;
  }

  interface DraggableData extends PanelPositionItem<RegisteredPanelTemplateId> {
    x: number;
    y: number;
  }

  function PanelTabDragger(props: PanelTabDraggerProps) {
    const { children, x, y, tab } = props;

    const data: DraggableData = useMemo(() => {
      return {
        ...tab,
        x,
        y,
      };
    }, [tab, x, y]);

    const { attributes, listeners, setNodeRef } = useDraggable({
      id: tab.id,
      data,
    });

    return (
      <div className="w-full" ref={setNodeRef} {...listeners} {...attributes}>
        {children}
      </div>
    );
  }

  interface GenericDropZoneProps {
    moveToOnDrop: MoveToConfig | ((data: DraggableData) => MoveToConfig);
    className?: string;
    id: string;
  }

  function GenericDropZone(props: GenericDropZoneProps) {
    const { moveToOnDrop, className, id } = props;
    const { active } = useDndContext();

    const data = useMemo(() => {
      if (!active?.data.current) {
        return undefined;
      }

      return typeof moveToOnDrop === 'function'
        ? moveToOnDrop(active.data.current as DraggableData)
        : moveToOnDrop;
    }, [active?.data, moveToOnDrop]);

    const { setNodeRef, isOver } = useDroppable({
      data,
      id,
    });

    return (
      <div
        ref={setNodeRef}
        className={cn(
          'opacity-0 w-full h-full inset-0 bg-blue-50 z-[10]',
          !active ? 'pointer-events-none' : '',
          isOver ? 'opacity-80' : '',
          className
        )}
      />
    );
  }

  const MoveToConfigSchema = z.object({
    x: z.number(),
    y: z.number(),
    tab: z.number(),
  });

  type MoveToConfig = z.infer<typeof MoveToConfigSchema>;

  interface DropZoneTabProps {
    moveToOnDrop: MoveToConfig;
    id: string;
    className?: string;
    position: 'left' | 'right';
  }

  function DropZoneTab(props: DropZoneTabProps) {
    const { moveToOnDrop, className, id, position } = props;

    const { active } = useDndContext();

    const { setNodeRef, isOver } = useDroppable({
      data: moveToOnDrop,
      id: `dropzone-tab-${moveToOnDrop.x}-${moveToOnDrop.y}-${moveToOnDrop.tab}`,
    });

    const allowOpenUI = useMemo(() => {
      return active?.id !== id && isOver;
    }, [active?.id, id, isOver]);

    return (
      <div>
        <div
          ref={setNodeRef}
          className={cn(
            'opacity-0 absolute w-[30%] h-full inset-0',
            position === 'left' ? 'left-0' : 'right-0 left-auto',
            !active ? 'pointer-events-none' : '',
            className
          )}
        />
        <div
          style={{
            width: allowOpenUI ? active?.rect.current.initial?.width : 0,
          }}
          className={cn(
            allowOpenUI ? 'w-[100px] bg-blue-50 z-[10]' : 'w-[0]',
            'transition-all h-full'
          )}
        />
      </div>
    );
  }

  function usePanelManager(): PanelManagerContextDataType {
    return useContext(PanelManagerContext);
  }

  function getDimensionId(x: number, y?: number) {
    return `dimension-${x}${y ? `-${y}` : ''}`;
  }

  interface XResizeHandleProps {
    x: number;
  }

  function XResizeHandle(props: XResizeHandleProps) {
    const { x } = props;

    const { resizeX } = usePanelManager();
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
          .getElementById(getDimensionId(x))
          ?.getBoundingClientRect().left;

        if (typeof panelLeft !== 'number') {
          throw new Error('Panel not found');
        }

        const nextWidth = ((event.clientX - panelLeft) / width) * 100;

        resizeX(x, nextWidth);
      },
      [resizeX, x]
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
        color="background"
        fullHeight
        className="absolute right-0 border-l h-full top-0 w-[5px] cursor-ew-resize"
      />
    );
  }

  interface YResizeHandleProps {
    x: number;
    y: number;
  }

  function YResizeHandle(props: YResizeHandleProps) {
    const { x, y } = props;

    const { resizeY } = usePanelManager();
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

    const handleSetHeight = useCallback(
      (event: MouseEvent) => {
        if (!isDragging.current) {
          return;
        }

        const { height } = getPanelRenderElement().getBoundingClientRect();

        const panelTop = document
          .getElementById(getDimensionId(x, y))
          ?.getBoundingClientRect().top;

        if (!panelTop) {
          throw new Error('Panel not found');
        }

        const nextHeight = ((event.clientY - panelTop) / height) * 100;

        resizeY(x, y, nextHeight);
      },
      [resizeY, x, y]
    );

    useEffect(() => {
      function handleMouseMove(event: MouseEvent) {
        handleSetHeight(event);
      }

      window.addEventListener('mousemove', handleMouseMove);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
      };
    }, [handleSetHeight]);

    return (
      <Frame
        onMouseDown={handleStartDrag}
        color="background"
        fullWidth
        className="absolute bottom-0 left-0 h-[5px] border-t cursor-ns-resize"
      />
    );
  }

  interface TabProps {
    tab: PanelPositionItem<RegisteredPanelTemplateId>;
    isActive: boolean;
    x: number;
    y: number;
  }

  function Tab(props: TabProps) {
    const { tab, x, y, isActive } = props;
    const { activatePanel, closePanel, movePanelToPosition } =
      usePanelManager();

    const tabId = tab.id;

    const handleClickedTab = useCallback(() => {
      activatePanel(tabId);
    }, [activatePanel, tabId]);

    const handleCloseTab = useCallback(() => {
      closePanel(tabId);
    }, [closePanel, tabId]);

    const handleMoveRight = useCallback(() => {
      movePanelToPosition(tabId, [x + 1, y, 0]);
    }, [tabId, movePanelToPosition, x, y]);

    const handleMoveDown = useCallback(() => {
      movePanelToPosition(tabId, [x, y + 1, 0]);
    }, [tabId, movePanelToPosition, x, y]);

    const title = panelRegistry[tab.templateId].useGetTitle(tab.data);

    const dropdownItems = useMemo(
      () => [
        {
          label: 'Split and move right',
          onClick: handleMoveRight,
        },
        {
          label: 'Split and move down',
          onClick: handleMoveDown,
        },
      ],
      [handleMoveDown, handleMoveRight]
    );

    return (
      <GenericTab
        isActive={isActive}
        onClickTab={handleClickedTab}
        onCloseTab={handleCloseTab}
        dropdownItems={dropdownItems}
        title={title}
      />
    );
  }

  interface TabBarProps {
    tabs: PanelItemTabsPositions<RegisteredPanelTemplateId>['positions'];
    activeTabId?: PanelId;
    x: number;
    y: number;
  }

  function TabBar(props: TabBarProps) {
    const { tabs, activeTabId, x, y } = props;

    const filteredTabs = tabs.filter(
      (tab) => !panelRegistry[tab.templateId].noTab
    );

    if (filteredTabs.length === 0) {
      return null;
    }

    return (
      <GenericPanelTabBar>
        {filteredTabs.map((tab, index) => {
          return (
            <HStack flex gap={false} position="relative" key={tab.id}>
              {index === 0 && (
                <DropZoneTab
                  id={tab.id}
                  position="left"
                  moveToOnDrop={{ x, y, tab: -1 }}
                />
              )}
              <PanelTabDragger x={x} y={y} tab={tab}>
                <Tab tab={tab} isActive={activeTabId === tab.id} x={x} y={y} />
              </PanelTabDragger>
              {index < filteredTabs.length - 1 && (
                <DropZoneTab
                  id={tab.id}
                  position="right"
                  moveToOnDrop={{ x, y, tab: index }}
                />
              )}
            </HStack>
          );
        })}
        {/*<GenericDropZone*/}
        {/*  id={`dropzone-tab-end-${x}-${y}`}*/}
        {/*  className="w-full"*/}
        {/*  moveToOnDrop={{ x, y, tab: tabs.length + 1 }}*/}
        {/*/>*/}
      </GenericPanelTabBar>
    );
  }

  interface PanelTabRendererProps {
    tabs: PanelItemTabsPositions<RegisteredPanelTemplateId>['positions'];
    x: number;
    y: number;
  }

  function PanelTabRenderer(props: PanelTabRendererProps) {
    const { tabs, x, y } = props;

    const validTabs = tabs.filter((tab) => !!panelRegistry[tab.templateId]);

    const activeTab = validTabs.find((tab) => tab.isActive);

    const isSidebar = panelRegistry[validTabs[0].templateId].noTab;

    return (
      <GenericTabRenderer
        tabBar={
          <TabBar x={x} y={y} activeTabId={activeTab?.id} tabs={validTabs} />
        }
        content={validTabs.map((tab) => {
          const PanelComponent = panelRegistry[tab.templateId].content;

          return (
            <GenericPanelContent key={tab.id} isActive={tab.isActive}>
              {!isSidebar && (
                <>
                  <GenericDropZone
                    id={`dropzone-tab-content-${tab.id}-top`}
                    className="left-[50%] w-[50%] absolute"
                    moveToOnDrop={({ x: dropX, y: dropY }) => {
                      if (dropX - 1 === x) {
                        return { x, y, tab: 0 };
                      }

                      if (dropY !== y && dropX === x) {
                        return { x, y, tab: 0 };
                      }

                      return { x: x + 1, y, tab: 0 };
                    }}
                  />
                  <GenericDropZone
                    id={`dropzone-tab-content-${tab.id}-bottom`}
                    className="h-[50%] top-[50%] w-full absolute"
                    moveToOnDrop={({ x: dropX, y: dropY }) => {
                      if (x === dropX && dropY - 1 === y) {
                        return { x, y, tab: 0 };
                      }

                      return { x, y: y + 1, tab: 0 };
                    }}
                  />
                </>
              )}
              <HStack gap={false} fullWidth fullHeight>
                <VStack fullHeight fullWidth>
                  <PanelComponent {...tab.data} />
                </VStack>
                <div className="w-[4px] h-full" />
              </HStack>
            </GenericPanelContent>
          );
        })}
      />
    );
  }

  function getPanelRenderElement() {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return document.getElementById('letta-web-panel-render-area')!;
  }

  function PanelRenderer() {
    const { positions: xPositions } = usePanelManager();

    return (
      <HStack id="letta-web-panel-render-area" gap={false} fullWidth fullHeight>
        {xPositions.map((xElement, x) => {
          return (
            <HStack
              id={getDimensionId(x)}
              position="relative"
              style={{ width: `${xElement.size}%` }}
              key={x}
            >
              <VStack gap={false} fullWidth fullHeight key={x}>
                {xElement.positions.map((yElement, y) => {
                  return (
                    <VStack
                      id={getDimensionId(x, y)}
                      position="relative"
                      style={{ height: `${yElement.size}%` }}
                      key={y}
                    >
                      <PanelTabRenderer
                        x={x}
                        y={y}
                        key={y}
                        tabs={yElement.positions}
                      />
                      {y < xElement.positions.length - 1 && (
                        <YResizeHandle x={x} y={y} />
                      )}
                    </VStack>
                  );
                })}
              </VStack>
              {x < xPositions.length - 1 && <XResizeHandle x={x} />}
            </HStack>
          );
        })}
      </HStack>
    );
  }

  interface PanelOpenerProps<
    TPanelTemplateId extends RegisteredPanelTemplateId
  > {
    templateId: TPanelTemplateId;
    data: ExtractPanelData<TPanelTemplateId>;
    id: string;
    children: React.ReactNode;
  }

  function PanelOpener<TPanelTemplateId extends RegisteredPanelTemplateId>(
    props: PanelOpenerProps<TPanelTemplateId>
  ) {
    const { templateId, data, id } = props;
    const { openPanel } = usePanelManager();

    return (
      <Slot
        onClick={() => {
          openPanel({ id, templateId, data });
        }}
      >
        {props.children}
      </Slot>
    );
  }

  function PanelCloser({ panelId }: { panelId: string }) {
    const { closePanel } = usePanelManager();

    return (
      <Slot
        onClick={() => {
          closePanel(panelId);
        }}
      >
        Close
      </Slot>
    );
  }

  function PanelToggle<PanelTemplateId extends RegisteredPanelTemplateId>(
    props: PanelOpenerProps<PanelTemplateId>
  ) {
    const { templateId, data, id } = props;
    const { openPanel, closePanel } = usePanelManager();
    const { getIsPanelIdActive } = usePanelManager();

    const isActive = getIsPanelIdActive(id);

    return (
      <Slot
        onClick={() => {
          if (isActive) {
            closePanel(id);
          } else {
            openPanel({ id, templateId, data });
          }
        }}
      >
        {props.children}
      </Slot>
    );
  }

  return {
    panelRegistry,
    PanelToggle,
    PanelRenderer,
    PanelOpener,
    PanelCloser,
    PanelManagerProvider,
    usePanelManager,
  };
}
