'use client';
import * as React from 'react';
import { makeInput, makeRawInput } from '../Form/Form';
import type { OptionType } from '../Select/Select';
import { HStack } from '../../framing/HStack/HStack';
import { Button } from '../Button/Button';
import { useCallback } from 'react';

interface ChipSelectProps {
  options: OptionType[];
  onChange: (chipState: OptionType[]) => void;
  value: OptionType[];
  isMultiSelect?: boolean;
}

function BaseChipSelect(props: ChipSelectProps) {
  const { options, onChange, value, isMultiSelect } = props;

  const handleChipSelect = useCallback(
    (selectedOption: OptionType, isSelected: boolean) => {
      if (isMultiSelect) {
        if (isSelected) {
          onChange(value.filter((chip) => chip.value !== selectedOption.value));
        } else {
          onChange([...value, selectedOption]);
        }
      } else {
        onChange([selectedOption]);
      }
    },
    [isMultiSelect, onChange, value]
  );

  return (
    <HStack wrap paddingY="xxsmall">
      {options.map((option) => {
        const isSelected = value.some((chip) => chip.value === option.value);

        return (
          <Button
            key={option.value}
            type="button"
            size="small"
            color="tertiary"
            active={isSelected}
            label={option.label}
            onClick={() => {
              handleChipSelect(option, isSelected);
            }}
          />
        );
      })}
    </HStack>
  );
}

export const RawChipSelect = makeRawInput(BaseChipSelect, 'ChipSelect', {
  fullWidth: true,
});

export const ChipSelect = makeInput(BaseChipSelect, 'ChipSelect', {
  fullWidth: true,
});
