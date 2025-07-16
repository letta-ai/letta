'use client';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { atom } from 'jotai';
import { cn } from '@letta-cloud/ui-styles';
import { DialogContext } from '../Dialog/Dialog';
import { DialogTitle } from '@radix-ui/react-dialog';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../Typography/Typography';
import { useTranslations } from '@letta-cloud/translations';
import { CloseIcon, FullscreenIcon, WindowedIcon } from '../../icons';
import { Tooltip } from '../Tooltip/Tooltip';
import { Slot } from '@radix-ui/react-slot';

type DynamicAppViewVariant = 'fullscreen' | 'windowed';

interface WindowConfiguration {
  minWidth: number;
  minHeight: number;
  defaultWidth: number;
  defaultHeight: number;
}

interface UseDynamicAppWindowedConfigurationOptions {
  configuration: WindowConfiguration;
}

function useDynamicAppWindowState(
  options: UseDynamicAppWindowedConfigurationOptions,
) {
  const { configuration } = options;
  const { minWidth, minHeight, defaultWidth, defaultHeight } = configuration;

  const [top, setTop] = React.useState<number>(0);
  const [left, setLeft] = React.useState<number>(0);

  const [width, setWidth] = React.useState<number>(defaultWidth);
  const [height, setHeight] = React.useState<number>(defaultHeight);

  const attachMove = useCallback(
    (dragElement: HTMLElement, windowElement: HTMLElement) => {
      if (!dragElement || !windowElement) return;

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

          const newTop = Math.max(
            -(windowHeight - minVisibleHeight), // Allow 90% to go off top edge
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

  const attachHeightResize = useCallback(
    (element: HTMLElement) => {
      // attach a listener to a div that resizes the height
      // check on mousedown and mouseup events and the y position of the mouse

      function handleMouseDown(event: MouseEvent) {
        const startY = event.clientY;

        function handleMouseMove(moveEvent: MouseEvent) {
          const newHeight = height + (moveEvent.clientY - startY);
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
    [handleHeightResize, height],
  );

  return {
    width,
    height,
    attachWidthResize,
    attachHeightResize,
    attachMove,
    top,
    left,
  };
}

const DialogRoot = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const CloseApp = DialogPrimitive.Close;

interface DynamicAppProps {
  name: string;
  trigger: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: (value: boolean) => void;
  defaultView?: DynamicAppViewVariant;
  windowConfiguration: WindowConfiguration;
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

const dynamicAppViewRegistryAtom = atom();

interface DynamicHeaderProps {
  title: string;
  view: DynamicAppViewVariant;
  onSetView: (view: DynamicAppViewVariant) => void;
  ref: React.Ref<HTMLDivElement>;
}

function DynamicHeader(props: DynamicHeaderProps) {
  const { title, view, ref, onSetView } = props;

  const t = useTranslations('DynamicApp.DynamicHeader');
  return (
    <HStack
      ref={ref}
      fullWidth
      color="background-grey2"
      className="min-h-[36px] h-[36px] px-4"
      align="center"
      justify="spaceBetween"
    >
      <DialogTitle>
        <Typography bold variant="body3">
          {title}
        </Typography>
      </DialogTitle>
      <HStack gap>
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

export function DynamicApp(props: DynamicAppProps) {
  const {
    windowConfiguration,
    children,
    name,
    isOpen,
    onOpenChange,
    defaultView,
    trigger,
  } = props;
  const [view, setView] = React.useState<DynamicAppViewVariant>(
    defaultView || 'fullscreen',
  );

  const {
    top,
    left,
    attachMove,
    width,
    height,
    attachWidthResize,
    attachHeightResize,
  } = useDynamicAppWindowState({ configuration: windowConfiguration });

  const isWindowed = view === 'windowed';
  const isFullscreen = view === 'fullscreen';

  const contentStyle = useMemo(() => {
    if (!isWindowed) {
      return undefined;
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      height: `${height}px`,
      minWidth: `${windowConfiguration.minWidth}px`,
      minHeight: `${windowConfiguration.minHeight}px`,
    };
  }, [
    height,
    isWindowed,
    left,
    top,

    width,
    windowConfiguration.minHeight,
    windowConfiguration.minWidth,
  ]);

  const headerRef = useRef<HTMLDivElement>(null);

  const windowRef = useRef<HTMLDivElement>(null);
  const widthResizeRef = useRef<HTMLDivElement>(null);
  const heightResizeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isWindowed && windowRef.current) {
      // Attach move handler to the header
      const headerElement = headerRef.current;
      if (headerElement) {
        return attachMove(headerElement, windowRef.current);
      }
    }
  }, [attachMove, isWindowed]);

  useEffect(() => {
    if (isWindowed && widthResizeRef.current) {
      return attachWidthResize(widthResizeRef.current);
    }
  }, [attachWidthResize, isWindowed]);

  useEffect(() => {
    if (isWindowed && heightResizeRef.current) {
      return attachHeightResize(heightResizeRef.current);
    }
  }, [attachHeightResize, isWindowed]);

  return (
    <DialogRoot modal={false} open={isOpen} onOpenChange={onOpenChange}>
      <DialogContext.Provider value={{ isInDialog: true }}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogPortal>
          {isFullscreen && (
            <div
              className={cn(
                'fixed inset-0 z-miniappShadow bg-black/30  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              )}
            />
          )}
          <DialogPrimitive.Content
            onInteractOutside={(e) => {
              if (isWindowed) {
                e.preventDefault();
              }
            }}
          >
            <div id="dialog-dropdown-content" className="z-dropdown" />
            <div
              ref={windowRef}
              style={contentStyle}
              className={cn(
                isFullscreen
                  ? 'left-[50%] top-[50%] max-h-[90dvh] max-w-[95vw] translate-x-[-50%] translate-y-[-50%]'
                  : '',
                'fixed border flex flex-col  transition-none w-full h-full text-base z-miniapp  gap-2  duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] bg-background',
              )}
            >
              <DynamicHeader
                ref={headerRef}
                onSetView={setView}
                view={view}
                title={name}
              />
              {children}
              <div
                ref={widthResizeRef}
                className="w-2 h-full cursor-col-resize absolute right-0 top-0"
              />
              <div
                ref={heightResizeRef}
                className="h-2 w-full cursor-row-resize absolute bottom-0 left-0"
              />
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </DialogContext.Provider>
    </DialogRoot>
  );
}
