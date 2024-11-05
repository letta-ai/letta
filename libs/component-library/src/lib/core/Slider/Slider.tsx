'use client';

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@letta-web/core-style-config';
import { HStack } from '../../framing/HStack/HStack';
import { useEffect, useMemo } from 'react';
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
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden bg-background-grey">
      <SliderPrimitive.Range className="absolute h-full bg-secondary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-4 cursor-pointer w-4 rounded-full border-secondary  border-2 bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
));
SliderRoot.displayName = SliderPrimitive.Root.displayName;

type SliderProps = React.ComponentProps<typeof SliderRoot>;

function SliderInput(props: SliderProps) {
  const { value, onValueChange, ...sliderProps } = props;

  const [sliderNumericValue, setSliderNumericValue] = useState<number>(
    value?.[0] || 0
  );
  const [sliderValue, setSliderValue] = useState<string>(
    value?.[0].toString() || ''
  );

  const handleSliderValueChange = useCallback(
    (value: string) => {
      if (!isNaN(Number(value))) {
        onValueChange?.([Number(value)]);
        setSliderNumericValue(Number(value));
      } else {
        setSliderNumericValue(0);
      }

      setSliderValue(value);
    },
    [onValueChange]
  );

  const controlledValue = useMemo(() => {
    if (Array.isArray(value)) {
      return value;
    }

    return [sliderNumericValue];
  }, [value, sliderNumericValue]);

  useEffect(() => {
    if (controlledValue[0].toString() !== sliderValue) {
      setSliderValue(controlledValue[0].toString());
    }
  }, [controlledValue, sliderValue]);

  return (
    <HStack className="min-w-[250px]" fullWidth>
      <SliderRoot
        value={controlledValue}
        className="w-full"
        onValueChange={(value) => {
          handleSliderValueChange(value[0].toString());
        }}
        {...sliderProps}
      />
      <input
        className="w-[75px] bg-background border px-1 py-1 rounded-sm"
        value={sliderValue}
        onChange={(e) => {
          handleSliderValueChange(e.target.value);
        }}
      />
    </HStack>
  );
}

export const Slider = makeInput(SliderInput, 'Slider');
export const RawSlider = makeRawInput(SliderInput, 'RawSlider');
