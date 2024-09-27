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
import { CaretDownIcon, Cross2Icon } from '../../../icons';
import { Typography } from '../../../core/Typography/Typography';
import { ADEDropdownMenu } from '../../ADEDropdownMenu/ADEDropdownMenu';
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

export type GenericPanelTemplateId = number | string | symbol;

export interface PanelTemplate<
  TPanelTemplateId extends GenericPanelTemplateId
> {
  templateId: TPanelTemplateId;
  title: string;
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
    openPanel: <TPanelTemplateId extends RegisteredPanelTemplateId>(
      options: OpenPanelOptions<TPanelTemplateId>
    ) => void;
    activatePanel: (panelId: PanelId) => void;
    closePanel: (panelId: PanelId) => void;
    movePanelToPosition: (panelId: PanelId, position: PanelPosition) => void;
    panelIdToPositionMap: Record<PanelId, PanelPosition>;
  }

  const PanelManagerContext = createContext<PanelManagerContextDataType>({
    positions: [],
    resizeX: () => {
      return false;
    },
    resizeY: () => {
      return false;
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
  });

  interface PanelManagerProps {
    children: React.ReactNode;
    initialPositions?: RegisteredPanelItemPositionsMatrix;
  }

  interface PanelState {
    positions: RegisteredPanelItemPositionsMatrix;
    panelIdToPositionMap: Record<PanelId, PanelPosition>;
    activePanelTemplates: Set<RegisteredPanelTemplateId>;
  }

  function PanelManagerProvider(props: PanelManagerProps) {
    const { children, initialPositions = [] } = props;

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

              if (!panelPosition) {
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

    const resizeX = useCallback((x: number, size: number) => {
      const totalWidthInPx =
        getPanelRenderElement().getBoundingClientRect().width;

      setState((prevState) => {
        const nextState = { ...prevState };

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

        if (desiredWidthInPx < 200 || neighbourPanelNewWidthInPx < 200) {
          return prevState;
        }

        nextState.positions[x + 1].size = neighbourPanelNewWidth;
        nextState.positions[x].size = size;

        return nextState;
      });
    }, []);

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
          // if the panelId is already in the panelIdToPositionMap, then the panel is already open
          if (prevState.panelIdToPositionMap[id]) {
            return prevState;
          }

          const panelPayload: PanelPositionItem<RegisteredPanelTemplateId> = {
            id,
            templateId,
            data,
            isActive: true,
          };

          const { positions: nextState } = reconcilePositions(
            prevState.positions
          );

          if (!nextState[0]) {
            nextState[0] = {
              size: 100,
              positions: [],
            };
          }

          if (!nextState[0].positions[0]) {
            nextState[0].positions[0] = {
              size: 100,
              positions: [],
            };
          }

          if (!nextState[0].positions[0].positions[0]) {
            nextState[0].positions[0].positions[0] = panelPayload;
          } else {
            const firstActivePanel = nextState[0].positions[0].positions.find(
              (panel) => panel.isActive
            );

            if (firstActivePanel) {
              const firstActivePanelIndex =
                nextState[0].positions[0].positions.indexOf(firstActivePanel);

              nextState[0].positions[0].positions[firstActivePanelIndex] = {
                ...nextState[0].positions[0].positions[firstActivePanelIndex],
                isActive: false,
              };

              nextState[0].positions[0].positions.splice(
                firstActivePanelIndex + 1,
                0,
                panelPayload
              );
            } else {
              nextState[0].positions[0].positions.push(panelPayload);
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
          const { positions: nextState } = reconcilePositions(
            prevState.positions
          );

          const position = prevState.panelIdToPositionMap[panelId];

          if (!position) {
            return prevState;
          }

          const [x, y, tab] = position;

          nextState[x].positions[y].positions.forEach((panel, tabIdx) => {
            panel.isActive = tabIdx === tab;
          });

          return reconcilePositions(nextState);
        });
      },
      [reconcilePositions]
    );

    const movePanelToPosition = useCallback(
      (panelId: PanelId, nextPosition: PanelPosition) => {
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
          let prepended = 0;

          if (tab === -1) {
            nextState[nextX].positions[nextY].positions.splice(
              0,
              0,
              panelToMove
            );

            prepended = 1;
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

          nextState[currentX].positions[currentY].positions.splice(
            currentTab + prepended,
            1
          );

          return reconcilePositions(nextState);
        });
      },
      [reconcilePositions]
    );

    const getIsPanelTemplateActive = useCallback(
      (panelTemplateId: RegisteredPanelTemplateId) => {
        return state.activePanelTemplates.has(panelTemplateId);
      },
      [state]
    );

    const value = useMemo(() => {
      return {
        getIsPanelTemplateActive,
        panelIdToPositionMap: state.panelIdToPositionMap,
        positions: state.positions,
        openPanel,
        closePanel,
        activatePanel,
        movePanelToPosition,
        resizeX,
        resizeY,
      };
    }, [
      getIsPanelTemplateActive,
      state.panelIdToPositionMap,
      state.positions,
      openPanel,
      closePanel,
      activatePanel,
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
  }

  function PanelTabDragger(props: PanelTabDraggerProps) {
    const { children, tab } = props;

    const { attributes, listeners, setNodeRef } = useDraggable({
      id: tab.id,
      data: tab,
    });

    return (
      <div ref={setNodeRef} {...listeners} {...attributes}>
        {children}
      </div>
    );
  }

  interface GenericDropZoneProps {
    moveToOnDrop: MoveToConfig;
    className?: string;
    id: string;
  }

  function GenericDropZone(props: GenericDropZoneProps) {
    const { moveToOnDrop, className, id } = props;
    const { active } = useDndContext();

    const { setNodeRef, isOver } = useDroppable({
      data: moveToOnDrop,
      id,
    });

    return (
      <div
        ref={setNodeRef}
        className={cn(
          'opacity-0 w-full h-full inset-0 bg-blue-50',
          !active ? 'pointer-events-none' : '',
          isOver ? 'opacity-100' : '',
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
            allowOpenUI ? 'w-[100px] bg-blue-200' : 'w-[0]',
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

        if (!panelLeft) {
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
        color="background-grey"
        fullHeight
        className="absolute bg-background right-0 h-full top-0 w-[5px] border-l border-r cursor-ew-resize"
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
        color="background-grey"
        fullWidth
        className="absolute bottom-0 bg-background left-0 h-[5px] border-t border-b cursor-ns-resize"
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

    return (
      <HStack
        paddingX="small"
        paddingY="xsmall"
        align="center"
        color={isActive ? 'background' : 'background-grey'}
      >
        <button className="h-full" onClick={handleClickedTab}>
          <Typography noWrap>{panelRegistry[tab.templateId].title}</Typography>
        </button>
        <ADEDropdownMenu
          trigger={
            <div className="w-2">
              <CaretDownIcon />
            </div>
          }
          items={[
            {
              label: 'Split and move right',
              onClick: handleMoveRight,
            },
            {
              label: 'Split and move down',
              onClick: handleMoveDown,
            },
          ]}
        />
        <button onClick={handleCloseTab}>
          <Cross2Icon />
        </button>
      </HStack>
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

    return (
      <HStack
        overflowY="hidden"
        className="min-h-[35px]"
        overflowX="auto"
        fullWidth
        gap={false}
      >
        {tabs.map((tab, index) => {
          return (
            <HStack gap={false} position="relative" key={tab.id}>
              {index === 0 && (
                <DropZoneTab
                  id={tab.id}
                  position="left"
                  moveToOnDrop={{ x, y, tab: -1 }}
                />
              )}
              <PanelTabDragger tab={tab}>
                <Tab tab={tab} isActive={activeTabId === tab.id} x={x} y={y} />
              </PanelTabDragger>

              <DropZoneTab
                id={tab.id}
                position="right"
                moveToOnDrop={{ x, y, tab: index }}
              />
            </HStack>
          );
        })}
        <GenericDropZone
          id={`dropzone-tab-end-${x}-${y}`}
          className="w-full"
          moveToOnDrop={{ x, y, tab: tabs.length + 1 }}
        />
      </HStack>
    );
  }

  interface PanelTabRendererProps {
    tabs: PanelItemTabsPositions<RegisteredPanelTemplateId>['positions'];
    x: number;
    y: number;
  }

  function PanelTabRenderer(props: PanelTabRendererProps) {
    const { tabs, x, y } = props;

    const activeTab = tabs.find((tab) => tab.isActive);

    return (
      <VStack fullHeight gap={false}>
        <TabBar x={x} y={y} activeTabId={activeTab?.id} tabs={tabs} />
        <VStack color="background" fullHeight fullWidth>
          {tabs.map((tab) => {
            const PanelComponent = panelRegistry[tab.templateId].content;

            return (
              <VStack
                key={tab.id}
                className={cn(tab.isActive ? 'flex' : 'hidden')}
                fullHeight
                fullWidth
              >
                <PanelComponent {...tab.data} />
              </VStack>
            );
          })}
        </VStack>
      </VStack>
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

  return {
    panelRegistry,
    PanelRenderer,
    PanelOpener,
    PanelCloser,
    PanelManagerProvider,
    usePanelManager,
  };
}
