'use client';
import * as React from 'react';
import type { MultiValue, SingleValue } from 'react-select';
import ReactSelect, { components } from 'react-select';
import { cn } from '@letta-web/core-style-config';
import type { ReactNode } from 'react';
import { CaretDownIcon, Cross2Icon } from '../../icons';
import { makeInput, makeRawInput } from '../Form/Form';

interface OptionType {
  value: string;
  label: string;
  options?: OptionType[];
}

interface SelectProps {
  isMulti?: boolean;
  isClearable?: boolean;
  isSearchable?: boolean;
  isDisabled?: boolean;
  onSelect?: (value: MultiValue<OptionType> | SingleValue<OptionType>) => void;
  options: OptionType[];
  value?: OptionType | OptionType[];
  noOptionsMessage?: (obj: { inputValue: string }) => ReactNode;
}

function SelectPrimitive(props: SelectProps) {
  return (
    <ReactSelect
      unstyled
      onChange={(value) => {
        props.onSelect?.(value);
      }}
      value={props.value}
      /* eslint-disable */
      components={{
        DropdownIndicator: CaretDownIcon,
        ClearIndicator: ({ ...props }) => (
          // @ts-ignore
          <components.ClearIndicator {...props}>
            {props.children}
            <Cross2Icon />
          </components.ClearIndicator>
        ),
        MultiValueRemove: ({ ...props }) => (
          // @ts-ignore
          <components.MultiValueRemove {...props}>
            {props.children}
            <Cross2Icon color="inherit" className="w-3" />
          </components.MultiValueRemove>
        ),
      }}
      styles={{
        control: (base) => ({ ...base, height: 'auto', minHeight: '36px' }),
        option: () => ({ fontSize: 'var(--font-size-base)' }),
        noOptionsMessage: () => ({ fontSize: 'var(--font-size-base)' }),
      }}
      classNames={{
        container: () => 'min-w-[200px]',
        control: () =>
          cn(
            'border border-solid h-[auto] px-2 py-1 min-h-[36px]! text-base rounded',
            'h-biHeight'
          ),
        placeholder: () => cn('text-muted-content'),
        menu: () => cn('mt-1 bg-background rounded border'),
        option: () => cn('px-3 py-2  hover:bg-background-hover'),
        noOptionsMessage: () => cn('py-3 px-3'),
        valueContainer: () => cn('flex items-center gap-2'),
        groupHeading: () =>
          cn(
            'border-b px-3 mt-3 pb-2 text-sm font-medium text-tertiary-content'
          ),
        multiValue: () =>
          cn(
            'bg-tertiary-dark h-[21px] gap-2 px-1 text-tertiary-content rounded-sm px-2'
          ),
      }}
      {...props}
    />
  );
}

export const Select = makeInput(SelectPrimitive, 'Select');
export const RawSelect = makeRawInput(SelectPrimitive, 'RawSelect');
