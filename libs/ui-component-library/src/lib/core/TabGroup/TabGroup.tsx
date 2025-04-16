'use client';
import React, { useMemo } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '@letta-cloud/ui-styles';
import { Slot } from '@radix-ui/react-slot';
import { Typography } from '../Typography/Typography';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { MaybeTooltip } from '../Tooltip/Tooltip';

interface TabItemType {
  label: string;
  value: string;
  hideLabel?: boolean;
  icon?: React.ReactNode;
  postIcon?: React.ReactNode;
}

const listVariant = cva('px-4 h-[28px] flex items-center gap-2 flex-row', {
  variants: {
    variant: {
      default:
        'border-b-2 border-b border-border pb-2 data-[state=active]:border-content pt-2',
      chips: ' font-medium',
    },
    color: {
      default: 'data-[state=active]:bg-background-grey2 ',
      dark: 'data-[state=active]:bg-dark-active data-[state=active]:text-secondary-active-content',
    },
    size: {
      small: 'h-biHeight',
      xsmall: '',
      xxsmall: 'px-2 h-[24px]',
    },
    fullWidth: {
      true: 'flex-1 justify-center',
    },
  },
  defaultVariants: {
    variant: 'default',
    color: 'default',
  },
  compoundVariants: [
    {
      color: 'default',
      variant: 'default',
      className: 'data-[state=active]:border-b',
    },
  ],
});

type TabAggregate = Tabs.TabsProps & VariantProps<typeof listVariant>;

interface TabGroupProps extends TabAggregate {
  items: TabItemType[];
  fullWidth?: boolean;
  upperCase?: boolean;
  bold?: boolean;
  extendBorder?: boolean;
  noBottomBorder?: boolean;
  border?: boolean;
  rightContent?: React.ReactNode;
}

export function TabGroup(props: TabGroupProps) {
  const {
    items,
    fullWidth,
    extendBorder,
    upperCase,
    value,
    bold,
    color,
    variant = 'default',
    border,
    size = 'xsmall',
    defaultValue,
    onValueChange,
    rightContent,
  } = props;

  const fontVariant = useMemo(() => {
    if (size === 'xsmall') {
      return 'body3';
    }

    if (size === 'xxsmall') {
      return 'body4';
    }

    return 'body2';
  }, [size]);

  const iconSize = useMemo(() => {
    if (size === 'xsmall') {
      return 'w-4 h-4';
    }

    if (size === 'xxsmall') {
      return 'w-3 h-3';
    }

    return 'w-5 h-5';
  }, [size]);

  return (
    <Tabs.Root
      className={cn(fullWidth || extendBorder ? 'w-full' : '')}
      value={value}
      onClick={(e) => {
        e.stopPropagation();
      }}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
    >
      <Tabs.List
        className={cn(
          'flex items-end flex-row',
          border ? 'p-[2px] border' : '',
        )}
      >
        {items.map((item) => (
          <MaybeTooltip
            renderTooltip={!!item.hideLabel}
            asChild
            content={item.hideLabel ? item.label : undefined}
            key={item.value}
          >
            <Tabs.Trigger
              className={cn(
                'px-4 h-[28px] flex items-center gap-2 flex-row ',
                listVariant({ variant, color, size, fullWidth }),
              )}
              onClick={(e) => {
                e.stopPropagation();
              }}
              value={item.value}
              data-testid={`tab-item:${item.value}`}
            >
              <Slot className={iconSize}>{item.icon}</Slot>
              {item.hideLabel ? (
                <div className="sr-only">item.label</div>
              ) : (
                <Typography
                  bold={bold}
                  variant={fontVariant}
                  uppercase={upperCase}
                  className="whitespace-nowrap"
                >
                  {item.label}
                </Typography>
              )}
              <Slot className={iconSize}>{item.postIcon}</Slot>
            </Tabs.Trigger>
          </MaybeTooltip>
        ))}
        {extendBorder && <div className="border-b flex-1">{rightContent}</div>}
      </Tabs.List>
    </Tabs.Root>
  );
}
