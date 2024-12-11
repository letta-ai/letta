import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { DialogOverlay } from '../../core/Dialog/Dialog';
import { cn } from '@letta-web/core-style-config';
import { CloseIcon } from '../../icons';

interface MiniAppProps {
  children: React.ReactNode;
  isOpen: boolean;
  defaultOpen?: boolean;
  onOpenChange: (value: boolean) => void;
  trigger: React.ReactNode;
  confirmOnClose?: boolean;
}

const DialogRoot = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;




export function MiniApp(props: MiniAppProps) {
  const { children, defaultOpen, isOpen, onOpenChange, trigger } = props;

  return (
    <DialogRoot
      defaultOpen={defaultOpen}
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogPortal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-miniapp bg-black/0  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
        />
        <DialogPrimitive.Content>
          <div
            className={cn(
              'fixed border flex flex-col max-h-[95dvh] w-full h-full text-base left-[50%] top-[50%] z-miniapp max-w-[95vw] translate-x-[-50%] translate-y-[-50%] gap-2 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] bg-background',
            )}
          >
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogRoot>
  );
}
