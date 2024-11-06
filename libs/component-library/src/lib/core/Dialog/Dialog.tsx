'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { CloseIcon } from '../../icons';
import { cn } from '@letta-web/core-style-config';
import type { ButtonProps } from '../Button/Button';
import { Button } from '../Button/Button';
import { useCallback } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { Alert } from '../Alert/Alert';
import { VStack } from '../../framing/VStack/VStack';

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
      'fixed inset-0 z-dialog bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

type DialogContentProps = React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> & {
  color?: 'background-grey' | 'background';
  size?: VariantProps<typeof dialogVariants>['size'];
  errorMessage?: string;
  errorAdditionalMessage?: string;
};

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(
  (
    {
      className,
      color,
      children,
      size,
      errorMessage,
      errorAdditionalMessage,
      ...props
    },
    ref
  ) => {
    const isFull = size === 'full';

    const contents = (
      <>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            'fixed flex flex-col max-h-[95vh] overflow-y-auto overflow-x-hidden text-base left-[50%] top-[50%] z-dialog w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-2 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
            color === 'background' ? 'bg-background' : 'bg-background-grey',
            className
          )}
          {...props}
        >
          <VStack gap={false} fullHeight={isFull}>
            {errorMessage && (
              <Alert
                fullWidth
                title={errorMessage}
                children={errorAdditionalMessage}
                variant="destructive"
                className="mb-4"
              />
            )}

            <VStack padding gap="form" position="relative" fullHeight={isFull}>
              {children}
              <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                <CloseIcon className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </VStack>
          </VStack>
        </DialogPrimitive.Content>
      </>
    );

    return <DialogPortal>{contents}</DialogPortal>;
  }
);
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
      xlarge: 'max-w-[800px]',
      full: 'max-w-[95vw] h-full max-h-[95vh]',
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
  errorAdditionalMessage?: string;
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
  color?: 'background-grey' | 'background';
  reverseButtons?: boolean;
}

export function Dialog(props: DialogProps) {
  const {
    isOpen,
    color = 'background-grey',
    defaultOpen,
    errorMessage,
    errorAdditionalMessage,
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
        color={color}
        size={size}
        errorMessage={errorMessage}
        errorAdditionalMessage={errorAdditionalMessage}
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
