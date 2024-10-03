import * as React from 'react';
import { InformationCircleIcon, WarningIcon } from '../../icons';
import { useMemo } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@letta-web/core-style-config';
import { HStack } from '../../framing/HStack/HStack';

const alertVariants = cva(
  'relative w-full items-start flex rounded-lg border px-4 py-3  text-sm gap-3',
  {
    variants: {
      variant: {
        destructive:
          'bg-background-destructive border-destructive-content text-background-destructive-content',
        info: 'bg-background-grey border-grey-content text-background-grey-content',
        warning:
          'bg-background-warning border-warning-content text-background-warning-content',
      },
    },
    defaultVariants: {
      variant: 'warning',
    },
  }
);

type AlertVariants = 'destructive' | 'info' | 'warning';

interface AlertProps extends VariantProps<typeof alertVariants> {
  children?: React.ReactNode;
  className?: string;
  title: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

const iconMap: Partial<Record<AlertVariants, React.ReactNode>> = {
  warning: <WarningIcon color="warning" />,
  destructive: <WarningIcon color="destructive" />,
  info: <InformationCircleIcon color="muted" />,
};

function isInIconMap(icon: unknown): icon is keyof typeof iconMap {
  if (typeof icon !== 'string') {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(iconMap, icon);
}

export function Alert(props: AlertProps) {
  const { children, action, className, title, icon, variant } = props;

  const defaultIcon = useMemo(() => {
    if (isInIconMap(variant)) {
      return iconMap[variant];
    }

    return null;
  }, [variant]);

  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)}>
      <div className="[&>svg]:h-[14px]">{icon || defaultIcon}</div>
      <div className="flex flex-col w-full text-base gap">
        <HStack fullWidth gap="small" justify="spaceBetween" align="start">
          <h5 className="font-medium">{title}</h5>
          {action}
        </HStack>
        {children && <p>{children}</p>}
      </div>
    </div>
  );
}

Alert.displayName = 'Alert';
