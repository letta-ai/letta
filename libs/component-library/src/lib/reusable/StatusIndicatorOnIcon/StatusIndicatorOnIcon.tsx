import * as React from 'react';
import type { StatusIndicatorVariantProps } from '../../core/StatusIndicator/StatusIndicator';
import { StatusIndicator } from '../../core/StatusIndicator/StatusIndicator';
import { Slot } from '@radix-ui/react-slot';

interface StatusIndicatorOnIconProps {
  status?: StatusIndicatorVariantProps['status'];
  label: string;
  icon: React.ReactNode;
  className?: string;
}

export function StatusIndicatorOnIcon(props: StatusIndicatorOnIconProps) {
  const { status, label, className, icon } = props;
  return (
    <div className="relative">
      <Slot className={className}>{icon}</Slot>
      {status && (
        <div className="absolute -bottom-[3px] right-0">
          <StatusIndicator status={status} tooltipContent={label} />
        </div>
      )}
    </div>
  );
}
