import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ButtonPrimitive, SpinnerPrimitive } from '../../../primitives';
import { cn } from '@letta-cloud/ui-styles';
import { forwardRef, useMemo } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { MaybeTooltip } from '../Tooltip/Tooltip';
import type { Placement } from '@floating-ui/react';

const buttonVariants = cva(
  'items-center cursor-pointer border inline-flex disable-app-header whitespace-nowrap transition-width duration-200 ease-in-out',
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
      square: {
        true: '',
      },

      color: {
        tertiary:
          'bg-transparent border-none hover:bg-secondary-hover hover:!text-brand-hover-content text-text-lighter',
        brand:
          'bg-brand-light hover:bg-brand-light-hover text-brand-light-content border-transparent',
        primary: 'bg-primary text-primary-content border-transparent',
        secondary:
          'bg-transparent hover:bg-secondary-hover text-text-default border-button-border',
        destructive:
          'bg-destructive hover:bg-destructive-hover text-white border-transparent',
        black:
          'bg-background-black text-background-black-content hover:bg-background-black-hover border-transparent',
        grey2:
          'bg-background-grey2 text-background-grey2-content hover:bg-background-grey2-hover border-transparent',
      },
      size: {
        '3xsmall': 'gap-1 px-[0.5] text-xs',
        '2xsmall': 'gap-1 px-[0.5] text-xs',
        xsmall:
          'px-2 py-1 h-biHeight-xs min-h-biHeight-xs text-xs font-medium gap-1',
        large:
          'px-6 py-2 h-biHeight-lg min-h-biHeight-lg text-base font-bold gap-2',
        default:
          'px-3 py-1 h-biHeight min-h-biHeight text-base font-semibold gap-2',
        small:
          'px-2 py-1 h-biHeight-sm min-h-biHeight-sm text-sm font-medium gap-2',
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
      {
        square: true,
        size: 'small',
        className:
          'w-biWidth-sm min-w-biWidth-sm p-0 items-center justify-center flex',
      },
      {
        square: true,
        size: 'default',
        className:
          'w-biWidth min-w-biWidth p-0 items-center justify-center flex',
      },
      {
        square: true,
        size: 'large',
        className:
          'w-biWidth-lg min-w-biWidth-lg p-0 items-center justify-center flex',
      },
      {
        square: true,
        size: 'xsmall',
        className:
          'w-biWidth-xs min-w-biWidth-xs p-0 items-center justify-center flex',
      },
      {
        square: true,
        size: '3xsmall',
        className:
          'w-[12px] min-w-[12px] h-[12px] max-h-[12px] p-0 items-center justify-center flex',
      },
      {
        square: true,
        size: '2xsmall',
        className:
          'w-4 min-w-4 h-4 max-h-4 p-0 items-center justify-center flex',
      },
      {
        hideLabel: true,
        size: 'xsmall',
        className:
          'w-biWidth-xs min-w-biWidth-xs p-0 items-center justify-center flex',
      },
    ],
    defaultVariants: {
      color: 'primary',
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
      hideLabelOnSmallPanel?: boolean;
      disabled?: boolean;
      fullWidthLabel?: boolean;
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
    active,
    fullWidth,
    animate,
    bold,
    align,
    fullHeight,
    square,
    size,
    fullWidthLabel,
    hideLabelOnSmallPanel,
    hideLabel,
    _use_rarely_className,
    _use_rarely_disableTooltip,
    ...rest
  } = props;

  const iconSize = useMemo(() => {
    if (size === '3xsmall') {
      return 'h-3 w-3';
    }

    if (size === '2xsmall') {
      return 'h-4 w-4';
    }

    if (size === 'small') {
      return 'h-4 w-4';
    }

    if (size === 'xsmall') {
      return 'h-3 w-3';
    }

    if (size === 'large') {
      return 'h-5 w-5';
    }

    return 'h-5 w-5';
  }, [size]);

  const iconToRender = useMemo(() => {
    if (busy) {
      return <SpinnerPrimitive  className={cn('text-inherit', iconSize)} />;
    }

    return <Slot className={iconSize}>{preIcon}</Slot>;
  }, [iconSize, busy, preIcon]);

  return (
    <MaybeTooltip
      ref={ref}
      asChild
      placement={tooltipPlacement}
      renderTooltip={!!hideLabel && !_use_rarely_disableTooltip}
      content={label}
    >
      <ButtonPrimitive
        className={cn(
          buttonVariants({
            color,
            hideLabel,
            animate,
            align,
            square,
            size,
            fullWidth,
            disabled: rest.disabled,
            fullHeight,
            active,
          }),
          _use_rarely_className,
        )}
        {...rest}
        data-active={active ? 'true' : undefined}
        disabled={rest.disabled || busy}
      >
        {iconToRender}
        {hideLabel ? (
          <span className="sr-only">{label}</span>
        ) : (
          <span
            className={cn(
              bold && 'font-bold',
              'button-label',
              hideLabelOnSmallPanel ? 'hide-label-on-small-panel' : '',
            )}
          >
            {label}
          </span>
        )}
        {postIcon && <Slot className={iconSize}>{postIcon}</Slot>}
      </ButtonPrimitive>
    </MaybeTooltip>
  );
});
