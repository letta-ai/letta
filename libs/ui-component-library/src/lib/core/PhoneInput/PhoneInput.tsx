'use client';
import * as React from 'react';
import 'react-phone-number-input/style.css';
import PhoneInputComponent from 'react-phone-number-input';
import { makeInput, makeRawInput } from '../Form/Form';
import { cn } from '@letta-cloud/ui-styles';
import { inputVariants } from '../Input/Input';

interface PhoneInputPrimitiveProps {
  onChange: (value: string | undefined) => void;
  value: string;
}

function PhoneInputPrimitive(props: PhoneInputPrimitiveProps) {
  const { onChange, value } = props;

  return (
    <PhoneInputComponent
      {...props}
      className={cn(inputVariants({ size: 'large' }), 'px-3')}
      value={value}
      onChange={onChange}
      international
      defaultCountry="US"
    />
  );
}

export const PhoneInput = makeInput(PhoneInputPrimitive, 'PhoneInput');
export const RawPhoneInput = makeRawInput(PhoneInputPrimitive, 'RawPhoneInput');
