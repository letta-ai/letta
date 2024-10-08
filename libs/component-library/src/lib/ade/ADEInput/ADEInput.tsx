'use client';
import * as React from 'react';
import { makeInput, makeRawInput } from '../../core/Form/Form';
import { cn } from '@letta-web/core-style-config';
import { ADEInputContainer } from '../_internal/ADEInputContainer/ADEInputContainer';
import { HStack } from '../../framing/HStack/HStack';
import { LockClosedIcon } from '../../icons';
import { Tooltip } from '../../core/Tooltip/Tooltip';
import { useTranslations } from 'next-intl';

type InputPrimitiveProps = Omit<React.ComponentProps<'input'>, 'className'>;

function ADEInputPrimitive(props: InputPrimitiveProps) {
  const { disabled } = props;
  const t = useTranslations('ComponentLibrary/ADEInput');

  return (
    <HStack align="center">
      {disabled && (
        <div className="mt-[-2px]">
          <Tooltip content={t('disabledTooltip')}>
            <LockClosedIcon className="w-3" color="muted" />
          </Tooltip>
        </div>
      )}
      <input
        {...props}
        /* Prevents autofill tools from annoying our users */
        autoComplete="off"
        data-lpignore="true"
        data-form-type="other"
        className={cn(
          'w-full h-biHeight bg-transparent text-base focus:outline-none',
          disabled ? 'cursor-not-allowed' : ''
        )}
      />
    </HStack>
  );
}

export const ADEInput = makeInput(ADEInputPrimitive, 'ADEInput', {
  fullWidth: true,
  container: ADEInputContainer,
});

export const RawADEInput = makeRawInput(ADEInputPrimitive, 'RawADEInput', {
  fullWidth: true,
  container: ADEInputContainer,
});
