import * as React from 'react';
import type {
  AlertPrimitiveProps,
  AlertVariants,
} from '../../../primitives/AlertPrimitive/AlertPrimitive';
import {
  AlertDescription,
  AlertPrimitive,
  AlertTitle,
} from '../../../primitives/AlertPrimitive/AlertPrimitive';
import { WarningIcon } from '../../icons';
import { useMemo } from 'react';

interface AlertProps extends Omit<AlertPrimitiveProps, 'children'> {
  children: React.ReactNode;
  title: string;
  icon?: React.ReactNode;
}

const iconMap: Partial<Record<AlertVariants, React.ReactNode>> = {
  warning: <WarningIcon color="warning" className="h-4" />,
};

export function Alert(props: AlertProps) {
  const { children, title, icon, variant } = props;

  const defaultIcon = useMemo(() => {
    return iconMap[variant || ''];
  }, [variant]);

  return (
    <AlertPrimitive variant={variant}>
      {icon || defaultIcon}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </AlertPrimitive>
  );
}
