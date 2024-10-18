import * as React from 'react';
import { CheckIcon, InfoIcon, WarningIcon } from '../../icons';
import { useMemo } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@letta-web/core-style-config';
import { HStack } from '../../framing/HStack/HStack';
import { Slot } from '@radix-ui/react-slot';

const alertVariants = cva(
  'relative w-full items-start flex border px-4 py-3  text-sm gap-0',
  {
    variants: {
      fullWidth: {
        true: 'w-full',
      },
      variant: {
        success: 'bg-primary-light text-primary-light-content',
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

export type AlertVariants = 'destructive' | 'info' | 'success' | 'warning';

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
  info: <InfoIcon color="muted" />,
  success: <CheckIcon color="default" />,
};

function isInIconMap(icon: unknown): icon is keyof typeof iconMap {
  if (typeof icon !== 'string') {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(iconMap, icon);
}

export function Alert(props: AlertProps) {
  const { children, fullWidth, action, className, title, icon, variant } =
    props;

  const defaultIcon = useMemo(() => {
    if (isInIconMap(variant)) {
      return iconMap[variant];
    }

    return null;
  }, [variant]);

  return (
    <div
      role="alert"
      className={cn(alertVariants({ fullWidth, variant }), className)}
    >
      <Slot className="w-6 h-6">{icon || defaultIcon}</Slot>
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
