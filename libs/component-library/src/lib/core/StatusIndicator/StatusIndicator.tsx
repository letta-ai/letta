import * as React from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { MaybeTooltip } from '../Tooltip/Tooltip';

const statusIndicatorVariants = cva('relative w-2 h-2 rounded-full', {
  variants: {
    status: {
      active: 'bg-green-500',
      processing: 'bg-warning animate-pulse',
      inactive: 'bg-destructive',
    },
  },
});

export type StatusIndicatorVariantProps = VariantProps<
  typeof statusIndicatorVariants
>;

interface StatusIndicatorProps extends StatusIndicatorVariantProps {
  tooltipContent?: string;
}

export function StatusIndicator(props: StatusIndicatorProps) {
  const { tooltipContent, ...rest } = props;

  return (
    <MaybeTooltip content={tooltipContent}>
      <div className={statusIndicatorVariants(rest)} />
    </MaybeTooltip>
  );
}
