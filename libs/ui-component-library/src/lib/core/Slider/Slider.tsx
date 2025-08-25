'use client';

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@letta-cloud/ui-styles';
import { HStack } from '../../framing/HStack/HStack';
import { useMemo } from 'react';
import { useCallback, useState } from 'react';
import { makeInput, makeRawInput } from '../Form/Form';

const SliderRoot = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      'relative flex w-full touch-none select-none items-center',
      className,
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden bg-background-grey3">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-4 cursor-pointer w-4 rounded-full border-primary border-2 bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
));
SliderRoot.displayName = SliderPrimitive.Root.displayName;

type SliderProps = Omit<
  React.ComponentProps<typeof SliderRoot>,
  'onValueChange' | 'value'
> & {
  fullWidth?: boolean;
  value: string;
  onValueChange?: (value: string) => void;
};

function SliderInput(props: SliderProps) {
  const { value, onValueChange, fullWidth, ...sliderProps } = props;

  const [sliderValue, setSliderValue] = useState<string>(value);

  const handleSliderValueChange = useCallback(
    (value: string) => {
      onValueChange?.(value);
      setSliderValue(value);
    },
    [onValueChange],
  );

  const controlledValue = useMemo(() => {
    if (typeof value !== 'undefined') {
      return [Number(value)];
    }

    return [Number(sliderValue)];
  }, [value, sliderValue]);

  const isSliderValueValid = useMemo(() => {
    return tryParseSliderNumber(sliderValue) !== false;
  }, [sliderValue]);

  return (
    <HStack className="min-w-[250px]" fullWidth={fullWidth}>
      <SliderRoot
        value={controlledValue}
        className="w-full"
        onValueChange={(value) => {
          handleSliderValueChange(value[0].toString());
        }}
        {...sliderProps}
      />
      <input
        data-testid={sliderProps.id ? `slider-input:${sliderProps.id}` : undefined}
        className={cn(
          'w-[75px] bg-panel-input-background text-panel-input-background-content border text-xs px-1 py-1',
          !isSliderValueValid && 'border-destructive',
        )}
        value={sliderValue}
        onChange={(e) => {
          handleSliderValueChange(e.target.value);
        }}
      />
    </HStack>
  );
}

export function tryParseSliderNumber(
  value: string,
  defaultValue?: number,
): number | false {
  const parsed = Number(value);
  if (isNaN(parsed)) {
    return defaultValue || false;
  }

  return parsed;
}

export const Slider = makeInput(SliderInput, 'Slider');
export const RawSlider = makeRawInput(SliderInput, 'RawSlider');
