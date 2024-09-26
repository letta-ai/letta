'use client';
import type { ZodSchema } from 'zod';
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
import ReactDOM from 'react-dom';
import { cn } from '@letta-web/core-style-config';
import './CreatePanelManager.css';

export type GenericPanelTemplateId = number | string | symbol;

export interface PanelRegistryItem<
  TPanelTemplateId extends GenericPanelTemplateId
> {
  templateId: TPanelTemplateId;
  title: string;
  data: ZodSchema;
  content: React.ComponentType<ZodSchema['_output']>;
}

type PanelTemplateRegistry<TPanelTemplateId extends GenericPanelTemplateId> =
  Record<TPanelTemplateId, PanelRegistryItem<TPanelTemplateId>>;

type PanelPosition = [number, number, number];

interface PanelPositionItem<TPanelTemplateId extends GenericPanelTemplateId> {
  id: string;
  templateId: TPanelTemplateId;
  data: PanelRegistryItem<TPanelTemplateId>['data']['_output'];
  isActive: boolean;
}

// panels exist in a three dimensional space
// the first dimension is the x axis
// the second dimension is the y axis
// the third dimension is the tab
export type PanelItemTabsPositions<
  TPanelTemplateId extends GenericPanelTemplateId
> = Array<PanelPositionItem<TPanelTemplateId>>;
export type PanelItemYPositions<
  TPanelTemplateId extends GenericPanelTemplateId
> = Array<PanelItemTabsPositions<TPanelTemplateId>>;
export type PanelItemPositionsMatrix<
  TPanelTemplateId extends GenericPanelTemplateId
> = Array<PanelItemYPositions<TPanelTemplateId>>;

export function createPanelManager<
  TPanelTemplateId extends GenericPanelTemplateId,
  TPanelRegistry extends PanelTemplateRegistry<TPanelTemplateId>
>(panelRegistry: TPanelRegistry) {
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
          const yPositions = xPositions[x];

          if (!yPositions) {
            xPositions.splice(x, 1);
            continue;
          }

          for (let y = yPositions.length - 1; y >= 0; y--) {
            const tabPositions = yPositions[y];

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
          const yPositions = xPositions[x];

          if (!yPositions || yPositions.length === 0) {
            xPositions.splice(x, 1);
            continue;
          }

          for (let y = yPositions.length - 1; y >= 0; y--) {
            const tabPositions = yPositions[y];

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
          yPositions.forEach((tabPositions, y) => {
            tabPositions.forEach((panelPosition, tab) => {
              panelIdToPositionMap[panelPosition.id] = [x, y, tab];
            });
          });
        });

        const activePanelTemplates = new Set<RegisteredPanelTemplateId>();

        positions.forEach((yPositions) => {
          yPositions.forEach((tabPositions) => {
            const firstActivePanel = tabPositions.find(
              (panel) => panel.isActive
            );

            tabPositions.forEach((panel) => {
              if (firstActivePanel && firstActivePanel.id === panel.id) {
                activePanelTemplates.add(panel.templateId);
              }
            });

            if (!firstActivePanel) {
              tabPositions[0].isActive = true;
            }
          });
        });

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
            nextState[0] = [];
          }

          if (!nextState[0][0]) {
            nextState[0][0] = [];
          }

          if (!nextState[0][0][0]) {
            nextState[0][0][0] = panelPayload;
          } else {
            const firstActivePanel = nextState[0][0].find(
              (panel) => panel.isActive
            );

            if (firstActivePanel) {
              const firstActivePanelIndex =
                nextState[0][0].indexOf(firstActivePanel);

              nextState[0][0][firstActivePanelIndex] = {
                ...nextState[0][0][firstActivePanelIndex],
                isActive: false,
              };

              nextState[0][0].splice(
                firstActivePanelIndex + 1,
                0,
                panelPayload
              );
            } else {
              nextState[0][0].push(panelPayload);
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

          nextState[x][y].splice(tab, 1);

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

          nextState[x][y].forEach((panel, tabIdx) => {
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

          if (!nextState[currentX]?.[currentY]?.[currentTab]) {
            return prevState;
          }

          const panelToMove = { ...nextState[currentX][currentY][currentTab] };

          // add panel to new position
          if (!nextState[nextX]) {
            nextState[nextX] = [];
          }

          if (!nextState[nextX][nextY]) {
            nextState[nextX][nextY] = [];
          }

          // if a tab already exists at the given position, move the panel next to it
          // if tab is -1 move it to become the first tab
          let prepended = 0;

          if (tab === -1) {
            nextState[nextX][nextY].splice(0, 0, panelToMove);

            prepended = 1;
          } else if (nextState[nextX][nextY][tab]) {
            nextState[nextX][nextY].splice(tab + 1, 0, panelToMove);
          } else {
            nextState[nextX][nextY].splice(tab, 0, panelToMove);
          }

          nextState[nextX][nextY] = nextState[nextX][nextY].map((panel) => {
            return {
              ...panel,
              isActive: panel.id === panelId,
            };
          });

          nextState[currentX][currentY].splice(currentTab + prepended, 1);

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
      };
    }, [
      getIsPanelTemplateActive,
      state,
      openPanel,
      closePanel,
      activatePanel,
      movePanelToPosition,
    ]);

    return (
      <PanelManagerContext.Provider value={value}>
        {children}
      </PanelManagerContext.Provider>
    );
  }

  const DROPZONE_CLASS = 'dropzone';

  interface PanelTabDraggerProps {
    children: React.ReactNode;
    panelId: PanelId;
  }

  interface DropzoneWindowPosition {
    top: number;
    left: number;
    bottom: number;
    right: number;
    element: HTMLElement;
  }

  function PanelTabDragger(props: PanelTabDraggerProps) {
    const { children, panelId } = props;
    const { movePanelToPosition } = usePanelManager();

    const draggableElement = useRef<HTMLDivElement>(null);

    const draggedElement = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const allDropzoneWindowPositions = useRef<DropzoneWindowPosition[]>([]);

    const handleDragStart = useCallback(() => {
      setIsDragging(true);
      document.body.dataset.isDraggingTabs = 'true';

      allDropzoneWindowPositions.current = Array.from(
        document.querySelectorAll(`.${DROPZONE_CLASS}`)
      ).map((dropzone) => {
        const { top, left, bottom, right } = dropzone.getBoundingClientRect();

        return { top, left, bottom, right, element: dropzone as HTMLElement };
      }, []);
    }, []);

    const handleMouseMove = useCallback(
      (event: MouseEvent) => {
        if (!isDragging) {
          return;
        }

        allDropzoneWindowPositions.current.forEach((dropzone) => {
          // if the mouse is within the dropzone, add the class "is-dragging-over" to the dropzone

          if (
            event.clientX > dropzone.left &&
            event.clientX < dropzone.right &&
            event.clientY > dropzone.top &&
            event.clientY < dropzone.bottom
          ) {
            dropzone.element.classList.add('is-dragging-over');
          } else {
            dropzone.element.classList.remove('is-dragging-over');
          }
        });

        if (draggedElement.current) {
          // make sure x and y are in the middle of the dragged element
          const { width, height } =
            draggedElement.current.getBoundingClientRect();

          draggedElement.current.style.left = `${event.clientX - width / 2}px`;
          draggedElement.current.style.top = `${event.clientY - height / 2}px`;
        }
      },
      [isDragging]
    );

    const handleDragEnd = useCallback(
      (event: MouseEvent) => {
        if (!isDragging) {
          return;
        }

        // see if the dragged element is over a dropzone
        const dropzone = allDropzoneWindowPositions.current.find((dropzone) => {
          const { top, left, bottom, right } = dropzone;

          return (
            event.clientX > left &&
            event.clientX < right &&
            event.clientY > top &&
            event.clientY < bottom
          );
        });

        if (dropzone) {
          const { x, y, tab } = dropzone.element.dataset;

          if (x && y && tab) {
            movePanelToPosition(panelId, [Number(x), Number(y), Number(tab)]);
          }

          // reset all dropzone classes
          allDropzoneWindowPositions.current.forEach((dropzone) => {
            dropzone.element.classList.remove('is-dragging-over');
          });
        }

        document.body.dataset.isDraggingTabs = 'false';
        setIsDragging(false);
      },
      [isDragging, movePanelToPosition, panelId]
    );

    useEffect(() => {
      if (draggedElement.current && draggableElement.current) {
        const { left, top } = draggableElement.current.getBoundingClientRect();

        draggedElement.current.style.left = `${left}px`;
        draggedElement.current.style.top = `${top}px`;
      }

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleDragEnd);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleDragEnd);
      };
    }, [handleMouseMove, handleDragEnd, isDragging]);

    return (
      <>
        <Slot onMouseDown={handleDragStart} ref={draggableElement}>
          {children}
        </Slot>
        {typeof document !== 'undefined' &&
          ReactDOM.createPortal(
            <Slot
              data-is-dragging={isDragging}
              ref={draggedElement}
              className={cn(
                'opacity-90 bg-white fixed z-draggedItem',
                isDragging ? 'block' : 'hidden'
              )}
            >
              {children}
            </Slot>,
            document.body
          )}
      </>
    );
  }

  interface DropZoneProps {
    x: number;
    y: number;
    tab: number;
    position: 'end' | 'start';
  }

  function DropZone(props: DropZoneProps) {
    const { x, y, tab, position } = props;
    return (
      <div>
        <div
          data-x={x}
          data-y={y}
          data-tab={tab}
          className={cn(
            position === 'start' ? 'left-0' : 'right-0',
            'opacity-0 pointer-events-none select-none h-full transition-all duration-75 w-[40%] absolute',
            DROPZONE_CLASS
          )}
        />
        <div className="drop-expander transition-all w-[0] h-full bg-blue-50" />
      </div>
    );
  }

  function usePanelManager(): PanelManagerContextDataType {
    return useContext(PanelManagerContext);
  }

  interface TabBarProps {
    tabs: PanelItemTabsPositions<RegisteredPanelTemplateId>;
    activeTabId?: PanelId;
    x: number;
    y: number;
  }

  function TabBar(props: TabBarProps) {
    const { tabs, activeTabId, x, y } = props;
    const { activatePanel, closePanel, movePanelToPosition } =
      usePanelManager();

    const handleClickedTab = useCallback(
      (panelId: PanelId) => {
        activatePanel(panelId);
      },
      [activatePanel]
    );

    const handleCloseTab = useCallback(
      (panelId: PanelId) => {
        closePanel(panelId);
      },
      [closePanel]
    );

    const handleMoveRight = useCallback(
      (panelId: PanelId) => {
        movePanelToPosition(panelId, [x + 1, y, 0]);
      },
      [movePanelToPosition, x, y]
    );

    const handleMoveDown = useCallback(
      (panelId: PanelId) => {
        movePanelToPosition(panelId, [x, y + 1, 0]);
      },
      [movePanelToPosition, x, y]
    );

    return (
      <HStack fullWidth gap={false}>
        {tabs.map((tab, index) => {
          return (
            <HStack gap={false} position="relative" key={tab.id}>
              {index === 0 && (
                <DropZone x={x} y={y} tab={-1} position="start" />
              )}
              <PanelTabDragger panelId={tab.id}>
                <HStack
                  paddingX="small"
                  paddingY="xsmall"
                  align="center"
                  color={
                    activeTabId === tab.id ? 'background' : 'background-grey'
                  }
                  key={index}
                >
                  <button
                    onClick={() => {
                      handleClickedTab(tab.id);
                    }}
                  >
                    <Typography>
                      {panelRegistry[tab.templateId].title}
                    </Typography>
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
                        onClick: () => {
                          handleMoveRight(tab.id);
                        },
                      },
                      {
                        label: 'Split and move down',
                        onClick: () => {
                          handleMoveDown(tab.id);
                        },
                      },
                    ]}
                  />
                  <button
                    onClick={() => {
                      handleCloseTab(tab.id);
                    }}
                  >
                    <Cross2Icon />
                  </button>
                </HStack>
              </PanelTabDragger>
              <DropZone x={x} y={y} tab={index + 1} position="end" />
            </HStack>
          );
        })}
      </HStack>
    );
  }

  interface PanelTabRendererProps {
    tabs: PanelItemTabsPositions<RegisteredPanelTemplateId>;
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
          {activeTab &&
            React.createElement(
              panelRegistry[activeTab.templateId].content,
              activeTab.data
            )}
        </VStack>
      </VStack>
    );
  }

  function PanelRenderer() {
    const { positions: xPositions } = usePanelManager();

    return (
      <HStack gap={false} fullWidth fullHeight>
        {xPositions.map((yPositions, x) => {
          return (
            <VStack borderRight gap={false} fullWidth fullHeight key={x}>
              {yPositions.map((tabPositions, y) => {
                return (
                  <PanelTabRenderer x={x} y={y} key={y} tabs={tabPositions} />
                );
              })}
            </VStack>
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
