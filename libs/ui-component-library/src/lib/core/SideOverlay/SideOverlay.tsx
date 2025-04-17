import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@letta-cloud/ui-styles';
import { DialogTitle } from '@radix-ui/react-dialog';
import { DialogContext } from '../../core/Dialog/Dialog';
import { HStack } from '../../framing/HStack/HStack';
import { CloseIcon } from '../../icons';

interface SideOverlayProps {
  children: React.ReactNode;
  isOpen: boolean;
  defaultOpen?: boolean;
  onOpenChange: (value: boolean) => void;
  trigger?: React.ReactNode;
  position?: 'left' | 'right';
  confirmOnClose?: boolean;
  title: string;
  overlay?: boolean;
  __use_rarely_className?: string;
}

const DialogRoot = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

export const CloseSideOverlay = DialogPrimitive.Close;

interface SideOverlayHeaderProps {
  children: React.ReactNode;
}

export function SideOverlayHeader(props: SideOverlayHeaderProps) {
  return (
    <HStack
      justify="spaceBetween"
      paddingX="small"
      paddingY="small"
      borderBottom
    >
      {props.children}

      <CloseSideOverlay>
        <CloseIcon />
      </CloseSideOverlay>
    </HStack>
  );
}

export function SideOverlay(props: SideOverlayProps) {
  const {
    overlay = true,
    children,
    title,
    defaultOpen,
    position = 'right',
    __use_rarely_className,
    isOpen,
    onOpenChange,
    trigger,
  } = props;

  return (
    <DialogRoot
      defaultOpen={defaultOpen}
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      <DialogContext.Provider value={{ isInDialog: true }}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogPortal>
          {overlay && (
            <DialogPrimitive.Overlay
              className={cn(
                'fixed inset-0 z-miniApp bg-black/40  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              )}
            />
          )}

          <DialogPrimitive.Content>
            <div id="dialog-dropdown-content" className="z-dropdown" />
            <div
              className={cn(
                'fixed border flex flex-col max-h-[100dvh] max-w-[650px] w-full  h-full text-base  top-[50%] z-miniApp translate-x-[0] translate-y-[-50%] gap-2 shadow-lg duration-200  bg-background',
                position === 'left' ? 'left-0' : 'right-0',
                __use_rarely_className,
              )}
            >
              <DialogTitle className="sr-only">{title}</DialogTitle>
              {children}
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </DialogContext.Provider>
    </DialogRoot>
  );
}
