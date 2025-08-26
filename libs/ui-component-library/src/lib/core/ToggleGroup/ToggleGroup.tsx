'use client';
import React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import * as TogglePrimitive from '@radix-ui/react-toggle';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@letta-cloud/ui-styles';
import type { ToggleGroupSingleProps } from '@radix-ui/react-toggle-group';
import { makeInput, makeRawInput } from '../Form/Form';
import { Frame } from '../../framing/Frame/Frame';
import { MaybeTooltip } from '../Tooltip/Tooltip';
import './ToggleGroup.scss';


const toggleVariants = cva(
  'inline-flex items-center justify-center text-sm font-medium ring-offset-background transition-colors hover:bg-secondary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-secondary-active ',
  {
    variants: {
      hideLabel: {
        true: '',
      },
      variant: {
        default: 'bg-transparent',
        outline:
          'border border-input bg-transparent hover:bg-accent hover:text-accent-content',
      },
      size: {
        default: 'h-biHeight px-3',
        small: 'h-biHeight-sm px-2.5',
        xsmall: 'h-biHeight-sm px-2',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
    compoundVariants: [
      {
        size: 'xsmall',
        hideLabel: true,
        className: 'w-biHeight-xsm',
      },
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
  },
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
  fullWidth: false,
});

const ToggleGroupRoot = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, children, fullWidth, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn('flex items-center justify-start gap-0', className)}
    {...props}
  >
    <ToggleGroupContext.Provider value={{ fullWidth, variant, size }}>
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
>(
  (
    { className, hideLabel: _, children, variant, fullWidth, size, ...props },
    ref,
  ) => {
    const context = React.useContext(ToggleGroupContext);

    return (
      <ToggleGroupPrimitive.Item
        data-testid={`toggle-group-item:${props.value}`}
        ref={ref}
        className={cn(
          toggleVariants({
            variant: context.variant || variant,
            size: context.size || size,
            fullWidth: context.fullWidth || fullWidth,
          }),
          className,
        )}
        {...props}
      >
        <div className="flex gap-2 items-center">{children}</div>
      </ToggleGroupPrimitive.Item>
    );
  },
);

ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

interface ToggleGroupItemType {
  label: string;
  value: string;
  icon?: React.ReactNode;
  postIcon?: React.ReactNode;
  hideLabel?: boolean;
}

interface ToggleGroupProps extends Omit<ToggleGroupSingleProps, 'type'> {
  items: ToggleGroupItemType[];
  border?: boolean;
  vertical?: boolean;
  fullWidth?: boolean;
  size?: VariantProps<typeof toggleVariants>['size'];
  color?: React.ComponentProps<typeof Frame>['color'];
  className?: string;
  padding?: React.ComponentProps<typeof Frame>['padding'];
}

function ToggleGroupWrapper(props: ToggleGroupProps) {
  const {
    items,
    vertical = false,
    border,
    fullWidth,
    size,
    value,
    onValueChange,
    color,
    className,
    padding,
  } = props;

  return (
    <Frame
      color={color}
      padding={padding}
      className={cn(
        border ? 'frame-border-hack' : '',
        fullWidth ? 'w-full' : '',
        className,
      )}
    >
      <ToggleGroupRoot
        type="single"
        value={value}
        className={cn(vertical ? 'flex-col' : 'flex-row')}
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
              className={cn(vertical ? 'min-h-biHeight' : '')}
              fullWidth={fullWidth}
              key={item.value}
              value={item.value}
            >
              {item.icon}
              <span className={item.hideLabel ? 'sr-only' : ''}>
                {item.label}
              </span>
              {item.postIcon}
            </ToggleGroupItem>
          </MaybeTooltip>
        ))}
      </ToggleGroupRoot>
    </Frame>
  );
}

export const ToggleGroup = makeInput(ToggleGroupWrapper, 'ToggleGroup');
export const RawToggleGroup = makeRawInput(ToggleGroupWrapper, 'ToggleGroup');
