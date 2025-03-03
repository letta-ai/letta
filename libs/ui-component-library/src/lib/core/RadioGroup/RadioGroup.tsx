'use client';

import * as React from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../Typography/Typography';
import { makeInput, makeRawInput } from '../Form/Form';
import { cn } from '@letta-cloud/ui-styles';

const radioGroupVariants = cva('flex flex-col gap-2', {
  variants: {
    variant: {
      blocky: '',
      default: '',
    },
    fullWidth: {
      true: 'w-full',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const radioGroupItemVariants = cva('flex items-center gap-2', {
  variants: {
    variant: {
      blocky:
        'flex-col gap-1 bg-background-grey p-4 border w-full data-[state=checked]:bg-brand-light data-[state=checked]:border-brand-light-border data-[state=checked]:text-brand-light-content',
      default: '',
    },
    fullWidth: {
      true: 'w-full',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const radioItemIndicatorVariants = cva(
  'border rounded-full h-2.5 w-2.5  justify-center',
  {
    variants: {
      variant: {
        blocky: 'w-5 h-5 bg-white',
        default: '',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

interface RadioGroupItemType {
  label: React.ReactNode;
  detail?: React.ReactNode;
  value: string;
}

type Base = React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> &
  VariantProps<typeof radioGroupVariants>;
interface ExtendedRadioGroupProps extends Base {
  items: RadioGroupItemType[];
  fullWidth?: boolean;
  hideLabel?: boolean;
}

function RadioGroupInput({ items, ...props }: ExtendedRadioGroupProps) {
  const { variant, hideLabel, fullWidth, ...rest } = props;
  const isBlocky = variant === 'blocky';

  return (
    <RadioGroupPrimitive.Root {...rest}>
      <RadioGroupPrimitive.RadioGroup
        value={rest.value}
        onValueChange={rest.onValueChange}
        className={cn(
          radioGroupVariants({ variant, fullWidth }),
          !hideLabel && isBlocky ? 'pt-2' : '',
        )}
      >
        {items.map((item) => (
          <HStack key={item.value}>
            <RadioGroupPrimitive.Item
              className={cn(radioGroupItemVariants({ variant, fullWidth }))}
              key={item.value}
              value={item.value}
            >
              <HStack fullWidth justify="spaceBetween" align="center">
                <HStack fullWidth align="center" justify="start">
                  <div className={cn(radioItemIndicatorVariants({ variant }))}>
                    <RadioGroupPrimitive.Indicator>
                      <div className="w-[100%] h-[100%] rounded-full bg-brand flex items-center justify-center">
                        {isBlocky && (
                          <div className="w-[50%] h-[50%] bg-white rounded-full " />
                        )}
                      </div>
                    </RadioGroupPrimitive.Indicator>
                  </div>
                  {isBlocky ? (
                    item.label
                  ) : (
                    <Typography>{item.label}</Typography>
                  )}
                </HStack>
                {item.detail && (
                  <Typography variant="heading6" bold>
                    {item.detail}
                  </Typography>
                )}
              </HStack>
            </RadioGroupPrimitive.Item>
          </HStack>
        ))}
      </RadioGroupPrimitive.RadioGroup>
    </RadioGroupPrimitive.Root>
  );
}

export const RadioGroup = makeInput(RadioGroupInput, 'radioGroup');
export const RawRadioGroup = makeRawInput(RadioGroupInput, 'radioGroup');
