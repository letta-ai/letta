import * as React from 'react';
import { CheckIcon, CloseIcon, InfoIcon, WarningIcon } from '../../icons';
import { useMemo } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@letta-cloud/ui-styles';
import { HStack } from '../../framing/HStack/HStack';
import { Slot } from '@radix-ui/react-slot';

const alertVariants = cva(
  'relative w-full items-start flex border px-4 py-3 gap-2  text-sm',
  {
    variants: {
      fullWidth: {
        true: 'w-full',
      },
      variant: {
        success: 'bg-brand-light text-brand-light-content',
        destructive:
          'bg-background-destructive border-destructive-content text-background-destructive-content',
        info: 'bg-background-grey border-grey-content text-background-grey-content',
        warning:
          'bg-background-warning border-warning-content text-background-warning-content',
        brand: 'bg-brand-light text-brand-light-content',
      },
    },
    defaultVariants: {
      variant: 'warning',
    },
  },
);

export type AlertVariants =
  | 'brand'
  | 'destructive'
  | 'info'
  | 'success'
  | 'warning';

interface AlertProps extends VariantProps<typeof alertVariants> {
  children?: React.ReactNode;
  className?: string;
  onDismiss?: () => void;
  title: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

const iconMap: Partial<Record<AlertVariants, React.ReactNode>> = {
  warning: <WarningIcon color="warning" />,
  destructive: <WarningIcon color="destructive" />,
  info: <InfoIcon color="muted" />,
  success: <CheckIcon color="black" />,
  brand: <InfoIcon color="brand" />,
};

function isInIconMap(icon: unknown): icon is keyof typeof iconMap {
  if (typeof icon !== 'string') {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(iconMap, icon);
}

export function Alert(props: AlertProps) {
  const {
    children,
    fullWidth,
    onDismiss,
    action,
    className,
    title,
    icon,
    variant,
  } = props;

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
      <div className="flex flex-col w-full text-sm gap-2">
        <HStack fullWidth gap="small" justify="spaceBetween" align="center">
          <HStack gap="medium" align="center">
            <Slot className="min-w-5 min-h-5">{icon || defaultIcon}</Slot>
            <h5 className="text-left font-medium text-sm">{title}</h5>
          </HStack>
          {action}
          {onDismiss && (
            <button
              className="mt-[3px]"
              onClick={() => {
                onDismiss();
              }}
            >
              <CloseIcon size="medium" />
            </button>
          )}
        </HStack>
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}

Alert.displayName = 'Alert';
