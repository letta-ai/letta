import * as React from 'react';
import {
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '../Form/Form';
import type { InputPrimitiveProps } from '../../primitives';
import { InputPrimitive } from '../../primitives';

export interface InputProps extends InputPrimitiveProps {
  label: string;
  hideLabel?: boolean;
  description?: string;
}

export function Input(props: InputProps) {
  const { label, hideLabel, description, ...inputProps } = props;

  return (
    <FormItem>
      <FormLabel className={hideLabel ? 'sr-only' : ''}>{label}</FormLabel>
      <FormControl>
        <InputPrimitive {...inputProps} />
      </FormControl>
      {description && <FormDescription>{description}</FormDescription>}
      <FormMessage />
    </FormItem>
  );
}
