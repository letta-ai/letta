'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { CloseIcon, PlusIcon } from '../../icons';
import { cn } from '@letta-cloud/ui-styles';
import type { ButtonProps } from '../Button/Button';
import { Button } from '../Button/Button';
import type { ComponentPropsWithoutRef, Ref } from 'react';
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
import { disableClosingOnNetworkInspector } from '@letta-cloud/utils-client';

const DialogRoot = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

interface DialogContextState {
  isInDialog: boolean;
  portalId: string;
}

export const DialogContext = React.createContext<DialogContextState>({
  isInDialog: false,
  portalId: 'dialog-dropdown-content',
});

export function useDialogContext() {
  return React.useContext(DialogContext);
}

type DialogOverlayProps = React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Overlay
>;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  DialogOverlayProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-testid="dialog-overlay"
    className={cn(
      'fixed inset-0 z-dialog bg-black/30  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

type DialogContentProps = React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> & {
  color?: 'background-grey' | 'background';
  headerVariant?: HeaderVariants;
  size?: VariantProps<typeof dialogVariants>['size'];
  errorMessage?: React.ReactNode;
  errorAdditionalMessage?: string;
  errorMessageAction?: React.ReactNode;
  additionalActions?: React.ReactNode;
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
      headerVariant,
      errorAdditionalMessage,
      errorMessageAction,
      additionalActions,
      ...props
    },
    ref,
  ) => {
    const isFull = size === 'full';

    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content ref={ref} {...props}>
          <div id="dialog-dropdown-content" className="z-dropdown" />
          <div className="fixed top-0 left-0  w-[100dvw] flex items-center justify-center h-[100dvh] z-dialog pointer-events-none">
            <div
              className={cn(
                'flex flex-col max-h-[95dvh] overflow-y-auto text-base pointer-events-auto w-full max-w-lg  gap-2 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
                color === 'background' ? 'bg-background' : 'bg-background-grey',
                className,
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
                    variant="destructive"
                    action={errorMessageAction}
                  >
                    {errorAdditionalMessage}
                  </Alert>
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
                  <HStack
                    align="center"
                    gap={false}
                    className={cn(
                      'absolute right-4',
                      headerVariant === 'emphasis'
                        ? 'top-[23px]'
                        : 'top-[13px]',
                    )}
                  >
                    {additionalActions}
                    <DialogPrimitive.Close asChild>
                      <Button
                        preIcon={<CloseIcon />}
                        hideLabel
                        size="xsmall"
                        color="tertiary"
                        label="Close"
                      />
                    </DialogPrimitive.Close>
                  </HStack>
                </VStack>
              </VStack>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const headerVariants = cva(
  'flex flex-col space-y-1.5 text-center sm:text-left',
  {
    variants: {
      variant: {
        emphasis: 'text-xl pt-5',
        default: 'bg-background-grey2',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  variant: HeaderVariants;
}

function DialogHeader({
  className,
  variant,
  color: _color,
  ...props
}: DialogHeaderProps) {
  return (
    <HStack
      paddingX="xlarge"
      className={cn(headerVariants({ variant }), className)}
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
    <HStack
      paddingY
      paddingX="xlarge"
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2',
        className,
      )}
      {...props}
      color={undefined}
    />
  );
}

DialogFooter.displayName = 'DialogFooter';

const titleVariants = cva(
  'text-base  flex items-center text-nowrap justify-start leading-none tracking-tight',
  {
    variants: {
      variant: {
        emphasis: 'text-[20px] font-bold',
        default: 'h-[48px] font-bold',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

interface DialogTitleProps
  extends ComponentPropsWithoutRef<typeof DialogPrimitive.Title> {
  variant: HeaderVariants;
  ref?: Ref<HTMLDivElement>;
}

function DialogTitle({ className, variant, ref, ...props }: DialogTitleProps) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(titleVariants({ variant }), className)}
      {...props}
    />
  );
}

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
    maintainAspectRatio: {
      true: '',
    },
    fullHeight: {
      true: 'h-full',
      false: '',
    },
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
  compoundVariants: [
    {
      size: 'large',
      maintainAspectRatio: true,
      className: 'h-full max-h-[600px]',
    },
  ],
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
        isActive ? 'active-dialog-category' : '',
      )}
      onClick={onClick}
      fullWidth
    >
      <HStack align="center" fullWidth>
        {isActive && <div className="w-[2px] absolute h-full bg-brand" />}
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
  props: DialogContentWithCategoriesProps,
) {
  const { categories, onCreateNewCategory, defaultCategory } = props;
  const [selectedCategory, setSelectedCategory] = React.useState(
    defaultCategory || categories[0].id,
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

type HeaderVariants = 'default' | 'emphasis';

interface DialogProps extends VariantProps<typeof dialogVariants> {
  isOpen?: boolean;
  testId?: string;
  errorMessage?: React.ReactNode;
  errorAdditionalMessage?: string;
  errorMessageAction?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  children?: React.ReactNode;
  trigger?: React.ReactNode;
  confirmText?: string;
  confirmColor?: ButtonProps['color'];
  padding?: boolean;
  headerVariant?: HeaderVariants;
  preventCloseFromOutside?: boolean;
  isConfirmBusy?: boolean;
  // if you do not want the dialog to be on the window but encapsulated in the parent component
  defaultOpen?: boolean;
  cancelText?: string;
  onConfirm?: () => void;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  disableForm?: boolean;
  disableSubmit?: boolean;
  hideCancel?: boolean;
  hideConfirm?: boolean;
  hideFooter?: boolean;
  fullHeight?: boolean;
  maintainAspectRatio?: boolean;
  color?: 'background-grey' | 'background';
  additionalActions?: React.ReactNode;
  reverseButtons?: boolean;
}

export function Dialog(props: DialogProps) {
  const {
    isOpen,
    color = 'background-grey',
    defaultOpen,
    disableSubmit,
    errorMessage,
    errorAdditionalMessage,
    errorMessageAction,
    maintainAspectRatio,
    onOpenChange,
    title,
    fullHeight,
    testId,
    hideFooter,
    children,
    reverseButtons,
    isConfirmBusy,
    additionalActions,
    disableForm,
    padding = true,
    headerVariant = 'default',
    trigger,
    confirmColor = 'primary',
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
    [onConfirm, onSubmit],
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
        additionalActions={additionalActions}
        headerVariant={headerVariant}
        errorMessage={errorMessage}
        errorAdditionalMessage={errorAdditionalMessage}
        errorMessageAction={errorMessageAction}
        className={dialogVariants({ size, fullHeight, maintainAspectRatio })}
        onInteractOutside={(e) => {
          const ret = disableClosingOnNetworkInspector(e);

          if (ret === false) {
            return false;
          }

          if (preventCloseFromOutside) {
            e.preventDefault();
            e.stopPropagation();
            return e;
          }

          return e;
        }}
        aria-describedby=""
      >
        <DialogContext.Provider
          value={{ portalId: 'dialog-dropdown-content', isInDialog: true }}
        >
          <DialogHeader variant={headerVariant}>
            <DialogTitle variant={headerVariant}>{title}</DialogTitle>
          </DialogHeader>
          <Element
            className={cn(
              'overflow-y-auto overflow-x-hidden flex flex-col flex-1',
              padding && 'pt-4',
              size === 'full' ? 'h-full' : '',
            )}
            /* @ts-expect-error - element */
            onSubmit={handleSubmit}
          >
            <VStack
              className={cn(
                'flex-1',
                padding && 'px-[24px]',
                size === 'full' ? 'h-full flex flex-col' : '',
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
                      color="secondary"
                    />
                  </DialogClose>
                )}
                {!hideConfirm && (
                  <Button
                    data-testid={`${testId}-confirm-button`}
                    color={confirmColor}
                    type="submit"
                    busy={isConfirmBusy}
                    disabled={disableSubmit}
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
