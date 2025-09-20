'use client';
import * as React from 'react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@letta-cloud/ui-styles';
import { DialogContext } from '../Dialog/Dialog';
import { DialogTitle } from '@radix-ui/react-dialog';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../Typography/Typography';
import { useTranslations } from '@letta-cloud/translations';
import {
  CloseIcon,
  DragIndicatorIcon,
  FullscreenIcon,
  ResizeAppIcon,
  WindowedIcon,
} from '../../icons';
import { Tooltip } from '../Tooltip/Tooltip';
import { Slot } from '@radix-ui/react-slot';
import './DynamicApp.scss';
import { atom, useAtom } from 'jotai';
import { useViewportSize } from '@mantine/hooks';
import { VStack } from '../../framing/VStack/VStack';

type DynamicAppViewVariant = 'fullscreen' | 'windowed';

interface WindowConfiguration {
  minWidth: number;
  minHeight: number;
  defaultWidth: number;
  defaultHeight: number;
}

interface UseDynamicAppWindowedConfigurationOptions {
  configuration: WindowConfiguration;
  isWindowed: boolean;
  isOpen: boolean;
}

function useDynamicAppWindowState(
  options: UseDynamicAppWindowedConfigurationOptions,
) {
  const { configuration, isWindowed, isOpen } = options;
  const { minWidth, minHeight, defaultWidth, defaultHeight } = configuration;

  const getCorrectDefaultWidth = useCallback(() => {
    if (typeof window === 'undefined') {
      // If we're on the server, return the default width
      return defaultWidth;
    }

    // if default width is larger than the viewport width, set it to the viewport width*0.90;
    const viewportWidth = window.innerWidth;
    return Math.min(viewportWidth * 0.9, defaultWidth);
  }, [defaultWidth]);

  const getCorrectDefaultHeight = useCallback(() => {
    if (typeof window === 'undefined') {
      // If we're on the server, return the default height
      return defaultHeight;
    }

    // if default height is larger than the viewport height, set it to the viewport height*0.90;
    const viewportHeight = window.innerHeight;
    return Math.min(viewportHeight * 0.9, defaultHeight);
  }, [defaultHeight]);

  const [width, setWidth] = React.useState<number>(getCorrectDefaultWidth);
  const [height, setHeight] = React.useState<number>(getCorrectDefaultHeight);

  const opened = useRef(isOpen);

  useEffect(() => {
    if (isWindowed) {
      // center the window when it opens
      if (isOpen) {
        if (opened.current) {
          // If the window is already opened, we don't need to reset the position
          return;
        }

        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        const nextHeight = Math.min(height, windowHeight * 0.9);
        const nextWidth = Math.min(width, windowWidth * 0.9);

        setLeft((windowWidth - nextWidth) / 2);
        setTop((windowHeight - nextHeight) / 2);

        setWidth(nextWidth);
        setHeight(nextHeight);

        opened.current = true;
      }
    }
  }, [width, height, isOpen, isWindowed]);

  useEffect(() => {
    if (!isOpen) {
      opened.current = false;
    }
  }, [isOpen]);

  const [top, setTop] = React.useState<number>(0);
  const [left, setLeft] = React.useState<number>(0);

  const attachMove = useCallback(
    (dragElement: HTMLElement, windowElement: HTMLElement) => {
      if (!dragElement || !windowElement) {
        return () => {
          return;
        };
      }

      // Remove any existing listeners to prevent duplicates
      dragElement.removeEventListener('mousedown', handleMouseDown);

      function handleMouseDown(event: MouseEvent) {
        // Prevent default to avoid text selection during drag
        event.preventDefault();

        const startX = event.clientX;
        const startY = event.clientY;
        const initialLeft = left;
        const initialTop = top;

        function handleMouseMove(moveEvent: MouseEvent) {
          // Calculate new position
          const deltaX = moveEvent.clientX - startX;
          const deltaY = moveEvent.clientY - startY;

          // Get window dimensions from the actual window element
          const windowRect = windowElement.getBoundingClientRect();
          const windowWidth = windowRect.width;
          const windowHeight = windowRect.height;

          // Allow 90% of window to be outside viewport (10% must remain visible)
          const minVisibleWidth = windowWidth * 0.1;
          const minVisibleHeight = windowHeight * 0.1;

          const newLeft = Math.max(
            -(windowWidth - minVisibleWidth), // Allow 90% to go off left edge
            Math.min(
              window.innerWidth - minVisibleWidth, // Allow 90% to go off right edge
              initialLeft + deltaX,
            ),
          );

          // For Y-axis: don't allow dragging higher than the drag element
          // but still allow 90% to go off the bottom
          const dragElementRect = dragElement.getBoundingClientRect();
          const dragElementHeight = dragElementRect.height / 2;

          const newTop = Math.max(
            -dragElementHeight, // Don't allow drag element to go above viewport
            Math.min(
              window.innerHeight - minVisibleHeight, // Allow 90% to go off bottom edge
              initialTop + deltaY,
            ),
          );

          setLeft(newLeft);
          setTop(newTop);
        }

        function handleMouseUp() {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        }

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }

      // Attach the mousedown listener to the drag element
      dragElement.addEventListener('mousedown', handleMouseDown);

      // Return cleanup function
      return () => {
        dragElement.removeEventListener('mousedown', handleMouseDown);
      };
    },
    [left, top, setLeft, setTop],
  );

  const handleHeightResize = useCallback(
    (newHeight: number) => {
      setHeight(Math.max(newHeight, minHeight));
    },
    [minHeight],
  );

  const handleWidthResize = useCallback(
    (newWidth: number) => {
      setWidth(Math.max(newWidth, minWidth));
    },
    [minWidth],
  );

  const attachWidthResize = useCallback(
    (element: HTMLElement) => {
      // attach a listener to a div that resizes the width
      // check on mousedown and mouseup events and the x position of the mouse
      function handleMouseDown(event: MouseEvent) {
        const startX = event.clientX;

        function handleMouseMove(moveEvent: MouseEvent) {
          const newWidth = width + (moveEvent.clientX - startX);
          handleWidthResize(newWidth);
        }

        function handleMouseUp() {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        }

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }

      element.addEventListener('mousedown', handleMouseDown);

      return () => {
        element.removeEventListener('mousedown', handleMouseDown);
      };
    },
    [handleWidthResize, width],
  );

  const attachCornerResize = useCallback(
    (element: HTMLElement) => {
      // attach a listener to a corner div that resizes both width and height
      // check on mousedown and mouseup events and the x and y position of the mouse

      function handleMouseDown(event: MouseEvent) {
        const startX = event.clientX;
        const startY = event.clientY;

        function handleMouseMove(moveEvent: MouseEvent) {
          const newWidth = width + (moveEvent.clientX - startX);
          const newHeight = height + (moveEvent.clientY - startY);
          handleWidthResize(newWidth);
          handleHeightResize(newHeight);
        }

        function handleMouseUp() {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        }

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }

      element.addEventListener('mousedown', handleMouseDown);

      return () => {
        element.removeEventListener('mousedown', handleMouseDown);
      };
    },
    [handleWidthResize, width, handleHeightResize, height],
  );

  const attachHeightResize = useCallback(
    (element: HTMLElement) => {
      // attach a listener to a div that resizes the height
      // check on mousedown and mouseup events and the y position of the mouse

      function handleMouseDown(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();

        const startY = event.clientY;

        function handleMouseMove(moveEvent: MouseEvent) {
          moveEvent.preventDefault();
          moveEvent.stopPropagation();

          const newHeight = height + (moveEvent.clientY - startY);
          handleHeightResize(newHeight);

          return false;
        }

        function handleMouseUp() {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        }

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }

      element.addEventListener('mousedown', handleMouseDown);

      return () => {
        element.removeEventListener('mousedown', handleMouseDown);
      };
    },
    [handleHeightResize, height],
  );

  return {
    width,
    height,
    attachWidthResize,
    attachHeightResize,
    attachMove,
    attachCornerResize,
    top,
    left,
  };
}

const DialogRoot = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const CloseApp = DialogPrimitive.Close;

interface FullscreenConfiguration {
  maxWidth?: number;
}

interface DynamicAppProps {
  name: string;
  trigger?: React.ReactNode;
  className?: string;
  __exclusive_isNetworkInspector?: boolean;
  defaultView?: DynamicAppViewVariant;
  windowConfiguration: WindowConfiguration;
  fullscreenConfiguration?: FullscreenConfiguration;
  isOpen?: boolean;
  onOpenChange?: (value: boolean) => void;
  children: React.ReactNode;
}

interface DynamicHeaderButtonProps {
  label: string;
  active?: boolean;
  onClick?: VoidFunction;
  icon: React.ReactNode;
}

function DynamicHeaderButton(props: DynamicHeaderButtonProps) {
  const { label, onClick, active, icon } = props;
  return (
    <Tooltip content={label} asChild>
      <div>
        <button className={cn(active ? '' : 'text-muted')} onClick={onClick}>
          <span className="sr-only">{label}</span>
          <Slot className="w-4 h-4">{icon}</Slot>
        </button>
      </div>
    </Tooltip>
  );
}

interface DynamicHeaderProps {
  title: string;
  view: DynamicAppViewVariant;
  forceMobileView?: boolean;
  onSetView: (view: DynamicAppViewVariant) => void;
  ref: React.Ref<HTMLDivElement>;
}

function DynamicHeader(props: DynamicHeaderProps) {
  const { title, view, forceMobileView, ref, onSetView } = props;

  const t = useTranslations('DynamicApp.DynamicHeader');
  return (
    <HStack
      ref={ref}
      fullWidth
      color="background-grey2"
      className={cn(
        'min-h-[36px] h-[36px] pr-4  cursor-move',
        view === 'fullscreen' ? 'pl-4' : 'pl-2',
      )}
      align="center"
      borderBottom
      justify="spaceBetween"
    >
      <DialogTitle>
        <HStack gap="small" align="center">
          {view !== 'fullscreen' && <DragIndicatorIcon color="muted" />}

          <Typography bold variant="body3">
            {title}
          </Typography>
        </HStack>
      </DialogTitle>
      <HStack gap>
        {!forceMobileView && (
          <>
            <DynamicHeaderButton
              label={t('fullscreen')}
              icon={<FullscreenIcon />}
              onClick={() => {
                onSetView('fullscreen');
              }}
              active={view === 'fullscreen'}
            ></DynamicHeaderButton>
            <DynamicHeaderButton
              label={t('windowed')}
              icon={<WindowedIcon />}
              onClick={() => {
                onSetView('windowed');
              }}
              active={view === 'windowed'}
            ></DynamicHeaderButton>
          </>
        )}

        <CloseApp asChild>
          <DynamicHeaderButton
            label={t('close')}
            icon={<CloseIcon size="medium" />}
          ></DynamicHeaderButton>
        </CloseApp>
      </HStack>
    </HStack>
  );
}

const focusedDynamicApp = atom<string | null>(null);

export function DynamicApp(props: DynamicAppProps) {
  const {
    windowConfiguration,
    fullscreenConfiguration = {},
    children,
    className,
    __exclusive_isNetworkInspector,
    name,
    isOpen: parentIsOpen,
    onOpenChange: parentOnOpenChange,
    defaultView,
    trigger,
  } = props;
  const id = useId();

  const [localIsOpen, localOnOpenChange] = useState(false);

  const isOpen = useMemo(() => {
    if (parentIsOpen !== undefined) {
      return parentIsOpen;
    }
    return localIsOpen;
  }, [parentIsOpen, localIsOpen]);

  const onOpenChange = useMemo(() => {
    if (parentOnOpenChange) {
      return parentOnOpenChange;
    }
    return localOnOpenChange;
  }, [parentOnOpenChange, localOnOpenChange]);

  const [_view, setView] = useState<DynamicAppViewVariant>(
    defaultView || 'windowed',
  );

  const { width: viewPortWidth, height: viewPortHeight } = useViewportSize();

  const [focusedAppId, setFocusedApp] = useAtom(focusedDynamicApp);

  const forceMobileView = useMemo(() => {
    // if the viewport height or width is less than 500px, switch to fullscreen view
    return viewPortHeight < 500 || viewPortWidth < 500;
  }, [viewPortHeight, viewPortWidth]);

  const view = useMemo(() => {
    // if the viewport height or width is less than 500px, switch to fullscreen view

    if (forceMobileView) {
      return 'fullscreen';
    }

    return _view;
  }, [_view, forceMobileView]);

  const isWindowed = view === 'windowed';
  const isFullscreen = view === 'fullscreen';

  const {
    top,
    left,
    attachMove,
    width,
    height,
    attachCornerResize,
    attachWidthResize,
    attachHeightResize,
  } = useDynamicAppWindowState({
    isOpen,
    isWindowed,
    configuration: windowConfiguration,
  });

  const contentStyle = useMemo(() => {
    if (!isWindowed) {
      return undefined;
    }

    let zIndex = focusedAppId === id ? 11 : 10;

    if (__exclusive_isNetworkInspector) {
      zIndex = 12;
    }

    return {
      zIndex: zIndex,
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      height: `${height}px`,
      minWidth: `${windowConfiguration.minWidth}px`,
      minHeight: `${windowConfiguration.minHeight}px`,
    };
  }, [
    focusedAppId,
    height,
    isWindowed,
    __exclusive_isNetworkInspector,
    left,
    id,
    top,
    width,
    windowConfiguration.minHeight,
    windowConfiguration.minWidth,
  ]);

  const { maxWidth } = fullscreenConfiguration;

  const headerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const widthResizeRef = useRef<HTMLDivElement>(null);
  const heightResizeRef = useRef<HTMLDivElement>(null);
  const bottomRightCornerResizeRef = useRef<HTMLDivElement>(null);

  const initializeWindowedMode = useCallback(() => {
    let detachOps: VoidFunction[] = [];

    if (!isWindowed) {
      return;
    }

    if (windowRef.current) {
      // Attach move handler to the header
      const headerElement = headerRef.current;
      if (headerElement) {
        detachOps.push(attachMove(headerElement, windowRef.current));
      }
    }

    if (widthResizeRef.current) {
      // Attach width resize handler
      detachOps.push(attachWidthResize(widthResizeRef.current));
    }

    if (heightResizeRef.current) {
      // Attach height resize handler
      detachOps.push(attachHeightResize(heightResizeRef.current));
    }

    if (bottomRightCornerResizeRef.current) {
      // Attach corner resize handler
      detachOps.push(attachCornerResize(bottomRightCornerResizeRef.current));
    }

    if (windowRef.current) {
      function setFocusedAppOnClick() {
        // Set the focused app when the window is clicked
        setFocusedApp(id);
      }

      // Attach refocus handler to the window
      windowRef.current.addEventListener('click', setFocusedAppOnClick);

      detachOps.push(() => {
        windowRef.current?.removeEventListener('click', setFocusedAppOnClick);
      });
    }

    // Cleanup function to remove all listeners
    return () => {
      detachOps.forEach((detach) => {
        detach();
      });
      detachOps = [];
    };
  }, [
    attachHeightResize,
    attachMove,
    attachWidthResize,
    attachCornerResize,
    id,
    isWindowed,
    setFocusedApp,
  ]);

  useEffect(() => {
    if (!isWindowed) {
      // If not in windowed mode, we don't need to initialize anything
      return;
    }

    const detachOps = initializeWindowedMode?.();
    return () => {
      detachOps?.();
    };
  }, [initializeWindowedMode, isWindowed]);

  return (
    <DialogRoot modal={false} open={isOpen} onOpenChange={onOpenChange}>
      <DialogContext.Provider
        value={{ portalId: 'dynamicapp-dropdown-content', isInDialog: true }}
      >
        {trigger && (
          <DialogTrigger ref={triggerRef} asChild>
            {trigger}
          </DialogTrigger>
        )}
        <DialogPortal>
          <div
            className={cn(
              className,
              !isFullscreen ? 'pointer-events-none opacity-0' : ' ',
              'fixed inset-0 z-miniappShadow bg-black/30   transition-opacity data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            )}
          />
          <DialogPrimitive.Content
            aria-describedby="dynamicapp-content"
            onOpenAutoFocus={() => {
              initializeWindowedMode?.();
            }}
            onInteractOutside={(e) => {
              e.preventDefault();
            }}
          >
            <div id="dynamicapp-dropdown-content" className="z-dropdown" />
            <div
              ref={windowRef}
              style={isFullscreen ? { maxWidth } : contentStyle}
              className={cn(
                isFullscreen
                  ? 'left-[50%] top-[50%] transition-width transition-height max-h-[90dvh] max-w-[95vw] translate-x-[-50%] translate-y-[-50%]'
                  : '',
                className,
                'fixed border dynamic-app  flex flex-col z-miniapp  w-full h-full text-base   duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] bg-background',
              )}
            >
              <DynamicHeader
                ref={headerRef}
                forceMobileView={forceMobileView}
                onSetView={setView}
                view={view}
                title={name}
              />
              <VStack collapseHeight flex>
                {children}
              </VStack>
              <div
                ref={widthResizeRef}
                className="w-2 h-full cursor-col-resize z-10  absolute right-0 top-0"
              />
              <div
                ref={heightResizeRef}
                className="h-2 w-full cursor-row-resize  z-10 absolute bottom-0 left-0"
              />
              {!isFullscreen && (
                <div
                  style={{
                    bottom: 10,
                    right: 3,
                  }}
                  ref={bottomRightCornerResizeRef}
                  className="w-2 h-2 cursor-nwse-resize z-10 dynamic-app-resize  absolute right-0 bottom-0"
                >
                  <ResizeAppIcon size="xsmall" color="muted" />
                </div>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </DialogContext.Provider>
    </DialogRoot>
  );
}
