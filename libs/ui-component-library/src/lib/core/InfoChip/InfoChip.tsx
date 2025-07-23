import * as React from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { cn } from '@letta-cloud/ui-styles';
import { Tooltip } from '../Tooltip/Tooltip';
import { Slot } from '@radix-ui/react-slot';
import { Typography } from '../Typography/Typography';

const infoChipVariants = cva(
  'items-center justify-center flex h-4 min-w-4 gap-1 px-[1px] border rounded-[2px] border-solid',
  {
    variants: {
      variant: {
        info: 'bg-background-grey ',
        success: 'bg-success-light text-success-light-content',
        brand: 'bg-brand-light text-brand-light-content',
        warning: 'bg-warning-light text-warning-light-content',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  },
);

interface InfoChipProps extends VariantProps<typeof infoChipVariants> {
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  value?: string;
}

export function InfoChip(props: InfoChipProps) {
  const { label, disabled, onClick, icon, variant, value } = props;
  return (
    <Tooltip asChild content={label} placement="top">
      <button
        disabled={disabled}
        onClick={() => {
          if (!disabled && onClick) {
            onClick();
          }
        }}
        className={cn(infoChipVariants({ variant }))}
      >
        <Slot className="max-w-3 min-w-3">{icon}</Slot>
        {value && <Typography variant="body4">{value}</Typography>}
      </button>
    </Tooltip>
  );
}
