'use client';
import React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import * as TogglePrimitive from '@radix-ui/react-toggle';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@letta-web/core-style-config';
import type { ToggleGroupSingleProps } from '@radix-ui/react-toggle-group';
import { makeInput, makeRawInput } from '../Form/Form';
import { Frame } from '../../framing/Frame/Frame';
import { MaybeTooltip } from '../Tooltip/Tooltip';
import './ToggleGroup.scss';

const toggleVariants = cva(
  'inline-flex items-center justify-center text-sm font-medium ring-offset-background transition-colors hover:bg-tertiary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-tertiary-active ',
  {
    variants: {
      hideLabel: {
        true: '',
      },
      variant: {
        default: 'bg-transparent',
        outline:
          'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-biHeight px-3',
        small: 'h-biHeight-sm px-2.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
    compoundVariants: [
      {
        size: 'small',
        hideLabel: true,
        className: 'w-biHeight-sm',
      },
      {
        size: 'default',
        hideLabel: true,
        className: 'w-biHeight',
      },
    ],
  }
);

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
));

Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants>
>({
  size: 'default',
  variant: 'default',
});

const ToggleGroupRoot = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn('flex items-center justify-start gap-0', className)}
    {...props}
  >
    <ToggleGroupContext.Provider value={{ variant, size }}>
      {children}
    </ToggleGroupContext.Provider>
  </ToggleGroupPrimitive.Root>
));

ToggleGroupRoot.displayName = ToggleGroupPrimitive.Root.displayName;

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps<typeof toggleVariants>
>(({ className, children, variant, size, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext);

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
});

ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

interface ToggleGroupItemType {
  label: string;
  value: string;
  icon?: React.ReactNode;
  hideLabel?: boolean;
}

interface ToggleGroupProps extends Omit<ToggleGroupSingleProps, 'type'> {
  items: ToggleGroupItemType[];
  border?: boolean;
  size?: VariantProps<typeof toggleVariants>['size'];
}

function ToggleGroupWrapper(props: ToggleGroupProps) {
  const { items, border, size, value, onValueChange } = props;

  return (
    <Frame className={cn(border ? 'frame-border-hack' : '')}>
      <ToggleGroupRoot
        type="single"
        value={value}
        onValueChange={onValueChange}
      >
        {items.map((item) => (
          <MaybeTooltip
            asChild
            key={item.value}
            content={item.label}
            renderTooltip={!!item.hideLabel}
          >
            <ToggleGroupItem
              hideLabel={item.hideLabel}
              size={size}
              key={item.value}
              value={item.value}
            >
              {item.icon}
              <span className={item.hideLabel ? 'sr-only' : ''}>
                {item.label}
              </span>
            </ToggleGroupItem>
          </MaybeTooltip>
        ))}
      </ToggleGroupRoot>
    </Frame>
  );
}

export const ToggleGroup = makeInput(ToggleGroupWrapper, 'ToggleGroup');
export const RawToggleGroup = makeRawInput(ToggleGroupWrapper, 'ToggleGroup');
