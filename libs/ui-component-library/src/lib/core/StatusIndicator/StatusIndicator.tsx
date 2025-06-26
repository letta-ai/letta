import * as React from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { MaybeTooltip } from '../Tooltip/Tooltip';
import { WarningIcon } from '../../icons';

const statusIndicatorVariants = cva('relative w-2 h-2 rounded-full', {
  variants: {
    status: {
      active: 'bg-green-500',
      processing: 'bg-warning animate-pulse',
      inactive: 'bg-destructive',
      warning: 'bg-warning',
      default: 'bg-black bg-opacity-50',
      brand: 'bg-brand',
    },
    animate: {
      true: 'animate-pulse',
      false: '',
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

  if (rest.status === 'warning') {
    return (
      <div className="w-2 relative">
        <MaybeTooltip asChild content={tooltipContent}>
          <div>
            <WarningIcon
              size="small"
              className="text-warning w-2 left-[-4px] absolute top-[4px] "
            />
          </div>
        </MaybeTooltip>
      </div>
    );
  }

  return (
    <MaybeTooltip
      asChild
      renderTooltip={!!tooltipContent}
      content={tooltipContent}
    >
      <div>
        <div className={statusIndicatorVariants(rest)} />
      </div>
    </MaybeTooltip>
  );
}
