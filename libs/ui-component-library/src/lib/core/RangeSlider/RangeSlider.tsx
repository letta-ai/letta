'use client';

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@letta-cloud/ui-styles';

interface RangeSliderProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
    'onValueChange' | 'value'
  > {
  fullWidth?: boolean;
  values: number[];
  onValueChange?: (values: number[]) => void;
  labelPosition?: 'bottom' | 'top';
  formatLabel?: (value: number) => React.ReactNode;
  errorMessage?: string;
  label?: string;
  minStepsBetweenThumbs?: number;
}

export const RangeSlider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  RangeSliderProps
>(
  (
    {
      values,
      onValueChange,
      labelPosition = 'top',
      formatLabel = (value) => value,
      fullWidth,
      className,
      label,
      errorMessage,
      minStepsBetweenThumbs = 1,
      ...props
    },
    ref,
  ) => (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        'relative flex touch-none select-none items-center',
        fullWidth && 'w-full',
        className,
      )}
      value={values}
      onValueChange={onValueChange}
      minStepsBetweenThumbs={minStepsBetweenThumbs}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden bg-background-grey3">
        <SliderPrimitive.Range className="absolute h-full bg-slider-active" />
      </SliderPrimitive.Track>
      {values.map((value, index) => (
        <SliderPrimitive.Thumb
          key={index}
          className="relative block h-4 cursor-pointer w-4 rounded-full border-background-grey3 border-2 bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          <span
            className={cn(
              'absolute flex w-full justify-center whitespace-nowrap text-xs pointer-events-none',
              labelPosition === 'top' && '-top-6',
              labelPosition === 'bottom' && 'top-6',
            )}
          >
            {formatLabel(value)}
          </span>
        </SliderPrimitive.Thumb>
      ))}
    </SliderPrimitive.Root>
  ),
);

RangeSlider.displayName = 'RangeSlider';
