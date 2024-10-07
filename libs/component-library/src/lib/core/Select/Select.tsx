'use client';
import * as React from 'react';
import type { MultiValue, SingleValue } from 'react-select';
import ReactSelect, { components } from 'react-select';
import AsyncReactSelect from 'react-select/async';
import { cn } from '@letta-web/core-style-config';
import type { ReactNode } from 'react';
import { CaretDownIcon, Cross2Icon } from '../../icons';
import { makeInput, makeRawInput } from '../Form/Form';
import { z } from 'zod';
import { HStack } from '../../framing/HStack/HStack';

export const OptionTypeSchemaSingle = z.object({
  value: z.string(),
  label: z.string(),
  description: z.string().optional(),
});

export interface OptionType {
  value: string;
  label: string;
  description?: string;
  badge?: ReactNode;
  options?: OptionType[];
}

export function isMultiValue(
  value: MultiValue<OptionType> | SingleValue<OptionType>
): value is MultiValue<OptionType> {
  return Array.isArray(value);
}

interface UseStylesArgs {
  menuWidth?: number;
}

interface BaseSelectProps {
  isMulti?: boolean;
  isClearable?: boolean;
  isSearchable?: boolean;
  'data-testid'?: string;
  placeholder?: string;
  isLoading?: boolean;
  defaultOptions?: OptionType[];
  isDisabled?: boolean;
  onSelect?: (value: MultiValue<OptionType> | SingleValue<OptionType>) => void;
  value?: OptionType | OptionType[];
  noOptionsMessage?: (obj: { inputValue: string }) => ReactNode;
  styleConfig?: UseStylesArgs;
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
  // @ts-expect-error yest
  Option: ({ children, ...props }) => (
    // @ts-expect-error yest
    <components.Option {...props}>
      <HStack data-testid={`select-box-option-${props.data.value}`}>
        {children}
        {props.data.badge}
      </HStack>
      {props.data.description && (
        <div className="text-xs text-muted">{props.data.description}</div>
      )}
    </components.Option>
  ),
};
/* eslint-enable @typescript-eslint/naming-convention */

const classNames = {
  container: () => 'min-w-[200px] w-full',
  control: () =>
    cn(
      'border bg-background border-solid h-[auto] px-2 py-1 min-h-[36px]! w-full text-base rounded',
      'h-biHeight'
    ),
  placeholder: () => cn('text-muted-content'),
  menu: () => cn('mt-1 bg-background rounded'),
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

function useStyles(args: UseStylesArgs) {
  const { menuWidth } = args;
  return {
    control: (base: any) => ({ ...base, height: 'auto', minHeight: '36px' }),
    option: () => ({ fontSize: 'var(--font-size-base)' }),
    noOptionsMessage: () => ({ fontSize: 'var(--font-size-base)' }),
    menu: (base: any) => ({
      ...base,
      ...(menuWidth ? { maxWidth: menuWidth, width: '100vw' } : {}),
    }),
  };
}

interface AsyncSelectProps extends BaseSelectProps {
  loadOptions: (inputValue: string) => Promise<OptionType[]>;
  cacheOptions?: boolean;
}

function AsyncSelectPrimitive(props: AsyncSelectProps) {
  const styles = useStyles(props.styleConfig || {});
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {props['data-testid'] && (
        <div
          className="absolute"
          onClick={() => {
            setOpen(true);
          }}
          data-testid={`${props['data-testid']}-trigger`}
        />
      )}
      <AsyncReactSelect
        unstyled
        onMenuOpen={() => {
          setOpen(true);
        }}
        onMenuClose={() => {
          setOpen(false);
        }}
        menuIsOpen={open}
        menuPortalTarget={
          typeof document !== 'undefined' ? document.body : null
        }
        onChange={(value) => {
          props.onSelect?.(value);
        }}
        value={props.value}
        components={overridenComponents}
        styles={styles}
        classNames={classNames}
        {...props}
      />
    </>
  );
}

interface SelectProps extends BaseSelectProps {
  options: OptionType[];
}

function SelectPrimitive(props: SelectProps) {
  const styles = useStyles(props.styleConfig || {});

  return (
    <ReactSelect
      unstyled
      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
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
