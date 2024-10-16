'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@letta-web/core-style-config';
import type { ButtonProps } from '../Button/Button';
import { Button } from '../Button/Button';
import { useCallback } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { Alert } from '../Alert/Alert';

const DialogRoot = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

type DialogOverlayProps = React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Overlay
>;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  DialogOverlayProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

type DialogContentProps = React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
>;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, ...props }, ref) => {
  const contents = (
    <>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed bg-background-grey max-h-[95vh] overflow-y-auto overflow-x-hidden text-base left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4  opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </>
  );

  return <DialogPortal>{contents}</DialogPortal>;
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col space-y-1.5 text-center sm:text-left',
        className
      )}
      {...props}
    />
  );
}
DialogHeader.displayName = 'DialogHeader';

function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2',
        className
      )}
      {...props}
    />
  );
}
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-xl font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

const dialogVariants = cva('', {
  variants: {
    size: {
      small: 'max-w-sm',
      medium: 'max-w-md',
      large: 'max-w-[600px]',
    },
  },
  defaultVariants: {
    size: 'medium',
  },
});

interface DialogProps extends VariantProps<typeof dialogVariants> {
  isOpen?: boolean;
  testId?: string;
  errorMessage?: string;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  children?: React.ReactNode;
  trigger?: React.ReactNode;
  confirmText?: string;
  confirmColor?: ButtonProps['color'];
  preventCloseFromOutside?: boolean;
  isConfirmBusy?: boolean;
  // if you do not want the dialog to be on the window but encapsulated in the parent component
  defaultOpen?: boolean;
  cancelText?: string;
  onConfirm?: () => void;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  hideCancel?: boolean;
  hideConfirm?: boolean;
  reverseButtons?: boolean;
}

export function Dialog(props: DialogProps) {
  const {
    isOpen,
    defaultOpen,
    errorMessage,
    onOpenChange,
    title,
    testId,
    children,
    reverseButtons,
    isConfirmBusy,
    trigger,
    confirmColor = 'secondary',
    preventCloseFromOutside,
    cancelText = 'Cancel',
    confirmText = 'Confirm',
    onSubmit,
    onConfirm,
    hideCancel,
    size,
    hideConfirm,
  } = props;

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      if (onConfirm) {
        e.preventDefault();
        e.stopPropagation();

        onConfirm();

        return;
      }

      if (onSubmit) {
        onSubmit(e);
      }

      return;
    },
    [onConfirm, onSubmit]
  );

  return (
    <DialogRoot
      defaultOpen={defaultOpen}
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className={dialogVariants({ size })}
        onInteractOutside={(e) => {
          if (preventCloseFromOutside) {
            e.preventDefault();
            e.stopPropagation();
            return e;
          }

          return e;
        }}
        aria-describedby=""
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="contents">
          {errorMessage && (
            <Alert
              title={errorMessage}
              variant="destructive"
              className="mb-4"
            />
          )}
          {children}
          <DialogFooter
            className={
              reverseButtons ? 'sm:flex-row-reverse sm:justify-start' : ''
            }
          >
            {!hideCancel && (
              <DialogClose asChild>
                <Button
                  data-testid={`${testId}-cancel-button`}
                  label={cancelText}
                  color="tertiary"
                />
              </DialogClose>
            )}
            {!hideConfirm && (
              <Button
                data-testid={`${testId}-confirm-button`}
                color={confirmColor}
                type="submit"
                busy={isConfirmBusy}
                label={confirmText}
              />
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
