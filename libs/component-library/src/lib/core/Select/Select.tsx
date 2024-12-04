'use client';
import * as React from 'react';
import type { MultiValue, SingleValue } from 'react-select';
import ReactSelect, { components } from 'react-select';
import AsyncReactSelect from 'react-select/async';
import { cn } from '@letta-web/core-style-config';
import type { ReactNode } from 'react';
import { CaretDownIcon, CloseIcon } from '../../icons';
import { makeInput, makeRawInput } from '../Form/Form';
import { z } from 'zod';
import { HStack } from '../../framing/HStack/HStack';
import { Slot } from '@radix-ui/react-slot';
import { Typography } from '../Typography/Typography';
import { useDialogContext } from '../Dialog/Dialog';

interface SelectOptionsContextProps {
  hideIconsOnOptions?: boolean;
}

const SelectOptionsContext = React.createContext<SelectOptionsContextProps>({});

const SelectOptionsProvider = SelectOptionsContext.Provider;

function useSelectOptionsContext() {
  return React.useContext(SelectOptionsContext);
}

export const OptionTypeSchemaSingle = z.object({
  value: z.string().optional(),
  label: z.string(),
  description: z.string().optional(),
});

export interface OptionType {
  icon?: ReactNode;
  value?: string;
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
      <CloseIcon />
    </components.ClearIndicator>
  ),
  MultiValueRemove: ({ ...props }) => (
    // @ts-expect-error yest
    <components.MultiValueRemove {...props}>
      <HStack align="center" gap="small">
        {props.data.icon && (
          <Slot className="max-h-3 w-3">{props.data.icon}</Slot>
        )}
        {props.children}
        <CloseIcon />
      </HStack>
    </components.MultiValueRemove>
  ),
  // @ts-expect-error yest
  SingleValue: ({ children, ...props }) => (
    // @ts-expect-error yest
    <components.SingleValue {...props}>
      <HStack align="center" gap="medium">
        <HStack align="center" gap="small" fullWidth>
          {props.data.icon && (
            <Slot className="max-h-3 w-3">{props.data.icon}</Slot>
          )}
          <Typography align="left" noWrap overflow="ellipsis">
            {children}
          </Typography>
        </HStack>
        {props.data.badge}
      </HStack>
    </components.SingleValue>
  ),
  // @ts-expect-error yest
  GroupHeading: ({ children, ...props }) => (
    // @ts-expect-error yest
    <components.GroupHeading {...props} style={{ padding: 0, margin: 0 }}>
      <HStack
        align="center"
        color="background-grey"
        paddingY="small"
        paddingX="medium"
      >
        {props.data.icon && (
          <Slot className="max-h-3 w-3">{props.data.icon}</Slot>
        )}
        <Typography bold className="mt-[-1px]">
          {children}
        </Typography>
      </HStack>
    </components.GroupHeading>
  ),
  // @ts-expect-error yest
  Option: ({ children, ...props }) => {
    const { hideIconsOnOptions } = useSelectOptionsContext();

    return (
      // @ts-expect-error yest
      <components.Option {...props}>
        <HStack
          align="center"
          data-testid={`select-box-option-${props.data.value}`}
        >
          <HStack align="center" fullWidth>
            {props.data.icon && !hideIconsOnOptions && (
              <Slot className="max-h-3  w-3">{props.data.icon}</Slot>
            )}
            <Typography align="left" noWrap overflow="ellipsis">
              {children}
            </Typography>
          </HStack>
          {props.data.badge}
        </HStack>
        {props.data.description && (
          <div className="text-xs text-muted">{props.data.description}</div>
        )}
      </components.Option>
    );
  },
};
/* eslint-enable @typescript-eslint/naming-convention */

const classNames = {
  container: () => 'min-w-[200px] w-full',
  control: () =>
    cn(
      'border bg-background border-solid h-[auto] px-2 py-1 min-h-[36px]! w-full text-base',
      'h-biHeight'
    ),
  placeholder: () => cn('text-muted-content'),
  menu: () => cn('mt-1 bg-background border'),
  option: () => cn('px-3 py-2  hover:bg-background-hover'),
  noOptionsMessage: () => cn('py-3 px-3'),
  valueContainer: () => cn('flex items-center gap-2'),
  groupHeading: () =>
    cn('border-b px-3 mt-3 pb-2 text-sm font-medium text-tertiary-content'),
  multiValue: () =>
    cn('bg-tertiary-dark h-[21px] gap-2 px-1 text-tertiary-content px-2'),
};

function useStyles(args: UseStylesArgs) {
  const { menuWidth } = args;
  return {
    menuPortal: (base: any) => ({ ...base, zIndex: 10 }),
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
  hideIconsOnOptions?: boolean;
}

function AsyncSelectPrimitive(_props: AsyncSelectProps) {
  const { hideIconsOnOptions, ...props } = _props;
  const styles = useStyles(props.styleConfig || {});
  const [open, setOpen] = React.useState(false);
  const { isInDialog } = useDialogContext();

  return (
    <SelectOptionsProvider value={{ hideIconsOnOptions }}>
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
          !isInDialog && typeof document !== 'undefined' ? document.body : null
        }
        onChange={(value) => {
          props.onSelect?.(value);
        }}
        value={props.value}
        // @ts-expect-error yest
        components={overridenComponents}
        styles={styles}
        classNames={classNames}
        {...props}
      />
    </SelectOptionsProvider>
  );
}

interface SelectProps extends BaseSelectProps {
  options: OptionType[];
  hideIconsOnOptions?: boolean;
}

function SelectPrimitive(_props: SelectProps) {
  const { hideIconsOnOptions, ...props } = _props;
  const styles = useStyles(props.styleConfig || {});
  const { isInDialog } = useDialogContext();
  const [open, setOpen] = React.useState(false);

  return (
    <SelectOptionsProvider value={{ hideIconsOnOptions }}>
      {props['data-testid'] && (
        <div
          className="absolute"
          onClick={() => {
            setOpen(true);
          }}
          data-testid={`${props['data-testid']}-trigger`}
        />
      )}
      <ReactSelect
        unstyled
        // menuIsOpen
        menuPortalTarget={
          !isInDialog && typeof document !== 'undefined' ? document.body : null
        }
        onChange={(value) => {
          props.onSelect?.(value);
        }}
        onMenuOpen={() => {
          setOpen(true);
        }}
        onMenuClose={() => {
          setOpen(false);
        }}
        menuIsOpen={open}
        value={props.value}
        // @ts-expect-error yest
        components={overridenComponents}
        styles={styles}
        classNames={classNames}
        {...props}
      />
    </SelectOptionsProvider>
  );
}

export const Select = makeInput(SelectPrimitive, 'Select');
export const RawSelect = makeRawInput(SelectPrimitive, 'RawSelect');
export const AsyncSelect = makeInput(AsyncSelectPrimitive, 'AsyncSelect');
export const RawAsyncSelect = makeRawInput(
  AsyncSelectPrimitive,
  'RawAsyncSelect'
);
