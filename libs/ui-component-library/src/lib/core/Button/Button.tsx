import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ButtonPrimitive, SpinnerPrimitive } from '../../../primitives';
import { cn } from '@letta-cloud/ui-styles';
import { forwardRef, useMemo } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { MaybeTooltip } from '../Tooltip/Tooltip';
import type { Placement } from '@floating-ui/react';

const buttonVariants = cva(
  'items-center cursor-pointer inline-flex  whitespace-nowrap transition-width duration-200 ease-in-out',
  {
    variants: {
      animate: {
        true: 'transition-colors duration-200 ease-in-out',
      },
      disabled: {
        true: 'cursor-not-allowed opacity-50',
      },
      fullWidth: {
        true: 'w-full justify-center',
      },
      fullHeight: {
        true: 'h-full',
      },
      align: {
        center: 'justify-center',
        left: 'justify-start',
        right: 'justify-end',
      },
      variant: {
        'inline-panel':
          'h-full px-3 text-base first:border-l-0 border-l last:border-r-0 border-r',
        default: ' border',
      },
      color: {
        tertiary:
          'bg-transparent border-none hover:bg-secondary-hover text-tertiary-content',
        brand:
          'bg-brand hover:bg-brand-hover text-brand-content border-transparent',
        primary: 'bg-primary text-primary-content border-transparent',
        secondary:
          'bg-transparent hover:bg-secondary-hover text-tertiary-content ',
        destructive:
          'bg-destructive hover:bg-destructive-hover text-white border-transparent',
        black:
          'bg-background-black text-background-black-content hover:bg-background-black-hover border-transparent',
      },
      size: {
        xsmall:
          'px-2 py-1 h-biHeight-xs min-h-biHeight-xs text-xs font-medium gap-2',
        large:
          'px-6 py-2 h-biHeight-lg min-h-biHeight-lg text-base font-bold gap-2',
        default:
          'px-4 py-1 h-biHeight min-h-biHeight text-base font-medium gap-2',
        small:
          'px-3 py-1 h-biHeight-sm min-h-biHeight-sm text-sm font-medium gap-2',
      },
      active: {
        true: '',
        brand: 'bg-brand-light text-brand-light-content',
      },
      hideLabel: {
        true: '',
      },
    },
    compoundVariants: [
      {
        color: 'secondary',
        active: true,
        className: 'bg-secondary-active',
      },
      {
        color: 'primary',
        active: true,
        className: 'border-white',
      },
      {
        color: 'tertiary',
        active: true,
        className: 'bg-secondary-active',
      },
      {
        variant: 'inline-panel',
        className: 'h-full',
      },
      {
        hideLabel: true,
        size: 'small',
        className:
          'w-biWidth-sm min-w-biWidth-sm p-0 items-center justify-center flex',
      },
      {
        hideLabel: true,
        size: 'default',
        className:
          'w-biWidth min-w-biWidth p-0 items-center justify-center flex',
      },
    ],
    defaultVariants: {
      color: 'primary',
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonProps = Omit<
  React.HTMLAttributes<HTMLAnchorElement | HTMLButtonElement> &
    VariantProps<typeof buttonVariants> & {
      preIcon?: React.ReactNode;
      postIcon?: React.ReactNode;
      tooltipPlacement?: Placement;
      label?: string;
      busy?: boolean;
      preload?: boolean;
      href?: string;
      disabled?: boolean;
      hideLabel?: boolean;
      target?: string;
      bold?: boolean;
      type?: 'button' | 'reset' | 'submit';
      _use_rarely_className?: string;
      _use_rarely_disableTooltip?: boolean;
    },
  'children' | 'className'
>;

export const Button = forwardRef<
  HTMLAnchorElement | HTMLButtonElement,
  ButtonProps
>(function Button(props, ref) {
  const {
    preIcon,
    postIcon,
    label,
    color,
    tooltipPlacement,
    busy,
    variant,
    active,
    fullWidth,
    animate,
    bold,
    align,
    fullHeight,
    size,
    hideLabel,
    _use_rarely_className,
    _use_rarely_disableTooltip,
    ...rest
  } = props;

  const iconSize = useMemo(() => {
    return size === 'small' ? 'w-4 h-4' : 'w-5 h-5';
  }, [size]);

  const iconToRender = useMemo(() => {
    if (busy) {
      return <SpinnerPrimitive className={iconSize} />;
    }

    return <Slot className={iconSize}>{preIcon}</Slot>;
  }, [iconSize, busy, preIcon]);

  return (
    <MaybeTooltip
      asChild
      placement={tooltipPlacement}
      renderTooltip={!!hideLabel && !_use_rarely_disableTooltip}
      content={label}
    >
      <ButtonPrimitive
        ref={ref}
        className={cn(
          buttonVariants({
            color,
            hideLabel,
            animate,
            align,
            size,
            variant,
            fullWidth,
            disabled: rest.disabled,
            fullHeight,
            active,
          }),
          _use_rarely_className,
        )}
        {...rest}
        disabled={rest.disabled || busy}
      >
        {iconToRender}
        {hideLabel ? (
          <span className="sr-only">{label}</span>
        ) : (
          <span className={cn(bold && 'font-bold')}>{label}</span>
        )}
        {postIcon && <Slot className={iconSize}>{postIcon}</Slot>}
      </ButtonPrimitive>
    </MaybeTooltip>
  );
});
