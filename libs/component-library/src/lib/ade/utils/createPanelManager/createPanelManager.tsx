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
import { Frame } from '../../../framing/Frame/Frame';

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

    const dragStartTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      setMounted(true);
    }, []);

    const draggableElement = useRef<HTMLDivElement>(null);

    const draggedElement = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const allDropzoneWindowPositions = useRef<DropzoneWindowPosition[]>([]);

    const handleDragStart = useCallback(() => {
      // activatePanel(panelId);

      if (dragStartTimeout.current) {
        clearTimeout(dragStartTimeout.current);
      }

      dragStartTimeout.current = setTimeout(() => {
        setIsDragging(true);
      }, 250);

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

    const clearDragStartTimeout = useCallback(() => {
      if (dragStartTimeout.current) {
        clearTimeout(dragStartTimeout.current);
      }
    }, []);

    const handleDragEnd = useCallback(
      (event: MouseEvent) => {
        if (dragStartTimeout.current) {
          clearDragStartTimeout();
        }

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
      [clearDragStartTimeout, isDragging, movePanelToPosition, panelId]
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
        <Slot
          onMouseUp={() => {
            clearDragStartTimeout();
          }}
          onMouseDown={handleDragStart}
          ref={draggableElement}
        >
          {children}
        </Slot>
        {mounted &&
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
        <div className="drop-expander transition-all w-[0] h-full bg-black opacity-50" />
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

  interface TabBarProps {
    tabs: PanelItemTabsPositions<RegisteredPanelTemplateId>['positions'];
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
      <HStack className="min-h-[35px]" overflowX="auto" fullWidth gap={false}>
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
                    className="h-full"
                    onClick={() => {
                      handleClickedTab(tab.id);
                    }}
                  >
                    <Typography noWrap>
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
