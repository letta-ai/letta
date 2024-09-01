import * as React from 'react';
import { WarningIcon } from '../../icons';
import { useMemo } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@letta-web/core-style-config';

const alertVariants = cva(
  'relative w-full items-start flex rounded-lg border px-4 py-3  text-sm gap-3',
  {
    variants: {
      variant: {
        warning:
          'bg-background-warning border-warning-foreground text-background-warning-foreground',
      },
    },
    defaultVariants: {
      variant: 'warning',
    },
  }
);

type AlertVariants = 'warning';

interface AlertProps extends VariantProps<typeof alertVariants> {
  children?: React.ReactNode;
  className?: string;
  title: React.ReactNode;
  icon?: React.ReactNode;
}

const iconMap: Partial<Record<AlertVariants, React.ReactNode>> = {
  warning: <WarningIcon color="warning" />,
};

export function Alert(props: AlertProps) {
  const { children, className, title, icon, variant } = props;

  const defaultIcon = useMemo(() => {
    return iconMap[variant || ''];
  }, [variant]);

  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)}>
      <div className="[&>svg]:h-[14px]">{icon || defaultIcon}</div>
      <div className="flex flex-col text-base gap">
        <h5 className="font-medium mt-[2px]">{title}</h5>
        {children && <p>{children}</p>}
      </div>
    </div>
  );
}

Alert.displayName = 'Alert';
