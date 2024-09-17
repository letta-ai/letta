'use client';
import * as React from 'react';
import type { MultiValue, SingleValue } from 'react-select';
import ReactSelect, { components } from 'react-select';
import AsyncReactSelect from 'react-select/async';
import { cn } from '@letta-web/core-style-config';
import type { ReactNode } from 'react';
import { CaretDownIcon, Cross2Icon } from '../../icons';
import { makeInput, makeRawInput } from '../Form/Form';

export interface OptionType {
  value: string;
  label: string;
  options?: OptionType[];
}

export function isMultiValue(
  value: MultiValue<OptionType> | SingleValue<OptionType>
): value is MultiValue<OptionType> {
  return Array.isArray(value);
}

interface BaseSelectProps {
  isMulti?: boolean;
  isClearable?: boolean;
  isSearchable?: boolean;
  placeholder?: string;
  isLoading?: boolean;
  defaultOptions?: OptionType[];
  isDisabled?: boolean;
  onSelect?: (value: MultiValue<OptionType> | SingleValue<OptionType>) => void;
  value?: OptionType | OptionType[];
  noOptionsMessage?: (obj: { inputValue: string }) => ReactNode;
}

/* eslint-disable @typescript-eslint/naming-convention */
const overridenComponents = {
  DropdownIndicator: () => <CaretDownIcon className="w-2 h-2" />,
  ClearIndicator: ({ ...props }) => (
    // @ts-expect-error yest
    <components.ClearIndicator {...props}>
      {props.children}
      <Cross2Icon />
    </components.ClearIndicator>
  ),
  MultiValueRemove: ({ ...props }) => (
    // @ts-expect-error yest
    <components.MultiValueRemove {...props}>
      {props.children}
      <Cross2Icon color="inherit" className="w-3" />
    </components.MultiValueRemove>
  ),
};
/* eslint-enable @typescript-eslint/naming-convention */

const styles = {
  control: (base: any) => ({ ...base, height: 'auto', minHeight: '36px' }),
  option: () => ({ fontSize: 'var(--font-size-base)' }),
  noOptionsMessage: () => ({ fontSize: 'var(--font-size-base)' }),
};

const classNames = {
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
    cn('border-b px-3 mt-3 pb-2 text-sm font-medium text-tertiary-content'),
  multiValue: () =>
    cn(
      'bg-tertiary-dark h-[21px] gap-2 px-1 text-tertiary-content rounded-sm px-2'
    ),
};

interface AsyncSelectProps extends BaseSelectProps {
  loadOptions: (inputValue: string) => Promise<OptionType[]>;
  cacheOptions?: boolean;
}

function AsyncSelectPrimitive(props: AsyncSelectProps) {
  return (
    <AsyncReactSelect
      unstyled
      onChange={(value) => {
        props.onSelect?.(value);
      }}
      value={props.value}
      components={overridenComponents}
      styles={styles}
      classNames={classNames}
      {...props}
    />
  );
}

interface SelectProps extends BaseSelectProps {
  options: OptionType[];
}

function SelectPrimitive(props: SelectProps) {
  return (
    <ReactSelect
      unstyled
      onChange={(value) => {
        props.onSelect?.(value);
      }}
      value={props.value}
      components={overridenComponents}
      styles={styles}
      classNames={classNames}
      {...props}
    />
  );
}

export const Select = makeInput(SelectPrimitive, 'Select');
export const RawSelect = makeRawInput(SelectPrimitive, 'RawSelect');
export const AsyncSelect = makeInput(AsyncSelectPrimitive, 'AsyncSelect');
export const RawAsyncSelect = makeRawInput(
  AsyncSelectPrimitive,
  'RawAsyncSelect'
);
