'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { CloseIcon, PlusIcon } from '../../icons';
import { cn } from '@letta-web/core-style-config';
import type { ButtonProps } from '../Button/Button';
import { Button } from '../Button/Button';
import { useCallback } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { Alert } from '../Alert/Alert';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../Typography/Typography';
import { Slot } from '@radix-ui/react-slot';
import './Dialog.scss';
import { HiddenOnMobile } from '../../framing/HiddenOnMobile/HiddenOnMobile';

const DialogRoot = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

interface DialogContextState {
  isInDialog: boolean;
}

const DialogContext = React.createContext<DialogContextState>({
  isInDialog: false,
});

export function useDialogContext() {
  return React.useContext(DialogContext);
}

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
      'fixed inset-0 z-dialog bg-black/30  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
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
        <DialogPrimitive.Content ref={ref} {...props}>
          <div id="dialog-dropdown-content" className="z-dropdown" />
          <div
            className={cn(
              'fixed flex flex-col max-h-[95dvh] text-base left-[50%] top-[50%] z-dialog w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-2 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
              color === 'background' ? 'bg-background' : 'bg-background-grey',
              className
            )}
          >
            <VStack
              className="max-h-[100%]"
              overflow="hidden"
              flex
              gap={false}
              fullHeight={isFull}
            >
              {errorMessage && (
                <Alert
                  fullWidth
                  title={errorMessage}
                  children={errorAdditionalMessage}
                  variant="destructive"
                  className="mb-4"
                />
              )}

              <VStack
                flex
                className="max-h-[100%]"
                overflow="hidden"
                gap={false}
                position="relative"
                fullHeight={isFull}
              >
                {children}
                <DialogPrimitive.Close className="absolute right-4 top-[13px] opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                  <CloseIcon className="h-5 w-5" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              </VStack>
            </VStack>
          </div>
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
    <HStack
      paddingX="xlarge"
      borderBottom
      className={cn(
        'flex flex-col space-y-1.5 text-center sm:text-left',
        className
      )}
      {...props}
      color="background-grey2"
    />
  );
}
DialogHeader.displayName = 'DialogHeader';

function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <HStack
      paddingY
      paddingX="xlarge"
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2',
        className
      )}
      {...props}
      color={undefined}
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
      'text-base font-bold h-[48px] flex items-center justify-start leading-none tracking-tight',
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
      xxlarge: 'max-w-[1024px]',
      full: 'max-w-[85vw] h-full max-h-[85dvh]',
    },
  },
  defaultVariants: {
    size: 'medium',
  },
});

interface ContentCategory {
  id: string;
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

interface DialogCategoryProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  isActive?: boolean;
  onClick?: () => void;
}

export function DialogCategory(props: DialogCategoryProps) {
  const { icon, title, subtitle, isActive, onClick } = props;

  return (
    <HStack
      type="button"
      color={isActive ? 'background' : undefined}
      as="button"
      borderBottom
      align="center"
      className={cn(
        'relative h-[58px]',
        isActive ? 'active-dialog-category' : ''
      )}
      onClick={onClick}
      fullWidth
    >
      <HStack align="center" fullWidth>
        {isActive && <div className="w-[2px] absolute h-full bg-primary" />}
        <HStack paddingY="small" paddingX="xlarge" align="center" gap="large">
          {icon && <Slot className="w-4 h-4">{icon}</Slot>}
          <VStack gap="text">
            <Typography variant="body2" align="left">
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" align="left" color="muted">
                {subtitle}
              </Typography>
            )}
          </VStack>
        </HStack>
      </HStack>
    </HStack>
  );
}

export interface DialogContentWithCategoriesProps {
  categories: ContentCategory[];
  category?: string;
  defaultCategory?: string;
  onSetCategory?: (category: string) => void;
  onCreateNewCategory?: {
    operation: () => string;
    title: string;
  };
}

export function DialogContentWithCategories(
  props: DialogContentWithCategoriesProps
) {
  const { categories, onCreateNewCategory, defaultCategory } = props;
  const [selectedCategory, setSelectedCategory] = React.useState(
    defaultCategory || categories[0].id
  );

  const handleCategoryClick = useCallback((categoryId: string) => {
    setSelectedCategory(categoryId);
  }, []);

  return (
    <HStack borderTop gap={false} fullWidth fullHeight>
      <HiddenOnMobile>
        <VStack borderRight gap={false} fullHeight width="sidebar">
          {categories.map((category) => {
            const isActive = selectedCategory === category.id;

            return (
              <DialogCategory
                key={category.id}
                icon={category.icon}
                title={category.title}
                subtitle={category.subtitle}
                isActive={isActive}
                onClick={() => {
                  handleCategoryClick(category.id);
                }}
              />
            );
          })}
          {onCreateNewCategory && (
            <DialogCategory
              title={onCreateNewCategory.title}
              icon={<PlusIcon />}
              onClick={async () => {
                setSelectedCategory(onCreateNewCategory.operation());
              }}
            />
          )}
        </VStack>
      </HiddenOnMobile>
      <VStack fullHeight flex overflowY="auto" fullWidth color="background">
        {
          categories.find((category) => category.id === selectedCategory)
            ?.children
        }
      </VStack>
    </HStack>
  );
}

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
  disableForm?: boolean;
  hideCancel?: boolean;
  hideConfirm?: boolean;
  hideFooter?: boolean;
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
    hideFooter,
    children,
    reverseButtons,
    isConfirmBusy,
    disableForm,
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

  const Element = disableForm ? 'div' : 'form';

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
        <DialogContext.Provider value={{ isInDialog: true }}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <Element
            className={cn(
              'overflow-y-auto overflow-x-hidden flex flex-col flex-1',
              'pt-4',
              size === 'full' ? 'h-full' : ''
            )}
            /* @ts-expect-error - element */
            onSubmit={handleSubmit}
          >
            <VStack
              className={cn(
                'flex-1',
                'px-[24px]',
                size === 'full' ? 'h-full flex flex-col' : ''
              )}
            >
              {children}
            </VStack>
            {!hideFooter && (
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
            )}
          </Element>
        </DialogContext.Provider>
      </DialogContent>
    </DialogRoot>
  );
}
