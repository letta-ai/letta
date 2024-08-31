import * as React from 'react';
import type { AlertPrimitiveProps } from '../../../primitives/AlertPrimitive/AlertPrimitive';
import {
  AlertDescription,
  AlertPrimitive,
  AlertTitle,
} from '../../../primitives/AlertPrimitive/AlertPrimitive';

interface AlertProps extends Omit<AlertPrimitiveProps, 'children'> {
  children: React.ReactNode;
  title: string;
  icon?: React.ReactNode;
}

export function Alert(props: AlertProps) {
  const { children, title, icon, variant } = props;

  return (
    <AlertPrimitive variant={variant}>
      {icon}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </AlertPrimitive>
  );
}
