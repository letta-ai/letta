'use client';
import * as React from 'react';
import type { MultiValue, SingleValue } from 'react-select';
import ReactSelect, { components } from 'react-select';
import AsyncReactSelect from 'react-select/async';
import AsyncCreatableReactSelect from 'react-select/async-creatable';

import { cn } from '@letta-cloud/ui-styles';
import { useCallback, useRef } from 'react';
import type { ReactNode } from 'react';

import { useEffect, useMemo } from 'react';
import { CaretDownIcon, CloseIcon } from '../../icons';
import { makeInput, makeRawInput } from '../Form/Form';
import { z } from 'zod';
import { HStack } from '../../framing/HStack/HStack';
import { Slot } from '@radix-ui/react-slot';
import { Typography } from '../Typography/Typography';
import { useDialogContext } from '../Dialog/Dialog';
import { VStack } from '../../framing/VStack/VStack';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { LettaLoader } from '../LettaLoader/LettaLoader';

interface SelectOptionsContextProps {
  hideIconsOnOptions?: boolean;
  testId?: string;
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
  data?: Record<string, string>;
}

export function isMultiValue(
  value: MultiValue<OptionType> | SingleValue<OptionType>,
): value is MultiValue<OptionType> {
  return Array.isArray(value);
}

interface UseStylesArgs {
  menuWidth?: number;
  containerWidth?: number;
  size?: 'default' | 'large' | 'small';
}

type BaseArgs = GetClassNameArgs & VariantProps<typeof controlVariants>;

interface BaseSelectProps extends BaseArgs {
  isMulti?: boolean;
  isClearable?: boolean;
  isSearchable?: boolean;
  'data-testid'?: string;
  placeholder?: string;
  isLoading?: boolean;
  hideDownCaret?: boolean;
  postIcon?: ReactNode;
  defaultOptions?: OptionType[];
  isDisabled?: boolean;
  onSelect?: (value: MultiValue<OptionType> | SingleValue<OptionType>) => void;
  value?: OptionType | OptionType[];
  noOptionsMessage?: (obj: { inputValue: string }) => ReactNode;
  styleConfig?: UseStylesArgs;
  fullWidth?: boolean;
  __use_rarely_className?: string;
}

/* eslint-disable @typescript-eslint/naming-convention */
function useSelectComponents(selectProps: BaseSelectProps) {
  const { hideDownCaret, postIcon } = selectProps;

  return useMemo(() => {
    return {
      DropdownIndicator: () => {
        if (hideDownCaret) {
          return null;
        }

        if (postIcon) {
          return <Slot className="w-4 h-4">{postIcon}</Slot>;
        }

        return <CaretDownIcon className="w-2 h-2" />;
      },
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
      Input: ({ ...props }) => {
        const { testId } = useSelectOptionsContext();

        return (
          // @ts-expect-error yest
          <components.Input
            {...props}
            data-testid={`select-text-area-${testId}`}
          />
        );
      },
      // @ts-expect-error yest
      MultiValueContainer: ({ children, ...props }) => (
        // @ts-expect-error yest
        <components.MultiValueContainer {...props}>
          <HStack
            color="background-grey2"
            paddingY="xxsmall"
            paddingX="xsmall"
            align="center"
            gap="small"
            border
            style={{ borderColor: 'hsl(var(--muted))' }}
          >
            {props.data.icon && (
              <Slot className="max-h-3 w-3">{props.data.icon}</Slot>
            )}
            {children}
          </HStack>
        </components.MultiValueContainer>
      ),
      // @ts-expect-error yest
      SingleValue: ({ children, ...props }) => {
        const badge = props.data.badge || null;

        return (
          // @ts-expect-error yest
          <components.SingleValue {...props}>
            <HStack align="center" fullWidth overflow="hidden" gap="medium">
              <HStack
                align="center"
                gap="small"
                flex
                collapseWidth
                overflow="hidden"
              >
                {props.data.icon && (
                  <Slot className="max-h-3 w-3">{props.data.icon}</Slot>
                )}
                <Typography
                  variant="body3"
                  fullWidth
                  align="left"
                  noWrap
                  overflow="ellipsis"
                >
                  {children}
                </Typography>
              </HStack>
              {badge}
            </HStack>
          </components.SingleValue>
        );
      },
      // @ts-expect-error yest
      GroupHeading: ({ children, ...props }) => (
        // @ts-expect-error yest
        <components.GroupHeading {...props} style={{ padding: 0, margin: 0 }}>
          <HStack
            align="center"
            paddingX="medium"
            className="h-[36px]"
            borderTop
          >
            <HStack fullWidth>
              {props.data.icon && (
                <Slot className="max-h-3 w-3">{props.data.icon}</Slot>
              )}
              <Typography variant="body3" bold className="mt-[-1px]">
                {children}
              </Typography>
            </HStack>
            {props.data.badge}
          </HStack>
        </components.GroupHeading>
      ),
      LoadingMessage: ({ ...props }) => (
        // @ts-expect-error yest
        <components.LoadingMessage
          {...props}
          className="p-4 flex items-center justify-center"
        >
          <LettaLoader variant="flipper" />
        </components.LoadingMessage>
      ),
      // @ts-expect-error yest
      Option: ({ children, ...props }) => {
        const { hideIconsOnOptions } = useSelectOptionsContext();

        return (
          // @ts-expect-error yest
          <components.Option {...props}>
            <HStack
              fullWidth
              align="center"
              data-testid={`select-box-option-${props.data.value}`}
              data-testid_alt={`select-box-option-container-${props.data.label}`}
            >
              <HStack align="center" collapseWidth flex gap="small">
                {props.data.icon && !hideIconsOnOptions && (
                  <Slot className="max-h-3  w-3">{props.data.icon}</Slot>
                )}
                <Typography
                  variant="body3"
                  align="left"
                  noWrap
                  fullWidth
                  overflow="ellipsis"
                >
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
  }, [hideDownCaret, postIcon]);
}

const controlVariants = cva(
  'border bg-panel-input-background text-panel-input-background-content border-solid px-2 py-1 w-full',
  {
    variants: {
      size: {
        default: 'h-inputHeight',
        large: 'h-biHeight-lg',
        small: 'h-biHeight-sm',
      },
    },
    defaultVariants: {},
  },
);

type GetClassNameArgs = VariantProps<typeof controlVariants>;

function useDebouncedLoadOptions<Input, Output>(
  fn: (arg: Input) => Promise<Output>,
  delay: number,
): (arg: Input) => Promise<Output> {
  const timeout = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    (arg: Input) => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }

      return new Promise((resolve) => {
        timeout.current = setTimeout(async () => {
          resolve(await fn(arg));
        }, delay);
      });
    },
    [fn, delay],
  );
}

/* eslint-enable @typescript-eslint/naming-convention */
function getClassNames(props: GetClassNameArgs = {}) {
  return {
    container: () => 'min-w-[200px] w-full',
    control: () =>
      cn(
        'border bg-panel-input-background text-panel-input-background-content border-solid px-2 py-1 w-full',
        controlVariants(props),
      ),
    placeholder: () => cn('text-muted-content text-xs'),
    menu: () =>
      cn(
        'mt-1 bg-panel-input-background text-panel-input-background-content border',
      ),
    option: () =>
      cn('px-2 py-2  hover:bg-background-hover flex w-full overflow-hidden'),
    noOptionsMessage: () => cn('py-3 px-3'),
    valueContainer: () => cn('flex items-center gap-1 text-xs'),
    groupHeading: () =>
      cn('border-b px-3 mt-3 pb-2 text-sm font-medium text-tertiary-content'),
    multiValue: () => cn('h-[21px] text-xs'),
  };
}

function useStyles(args: UseStylesArgs) {
  const { menuWidth, containerWidth } = args;
  return {
    container: (base: any) => ({
      ...base,
      ...(containerWidth
        ? { minWidth: containerWidth, width: containerWidth }
        : {}),
    }),
    menuPortal: (base: any) => ({ ...base, zIndex: 11 }),
    control: (base: any) => ({
      ...base,
      height: 'auto',
      minHeight: (() => {
        if (args.size === 'large') {
          return 'var(--button-input-height-lg)';
        }

        if (args.size === 'small') {
          return 'var(--button-input-height-sm)';
        }

        return 'var(--input-height)';
      })(),
    }),
    option: () => ({ fontSize: 'var(--font-size-xs)' }),
    noOptionsMessage: () => ({ fontSize: 'var(--font-size-xs)' }),
    menu: (base: any) => ({
      ...base,
      ...(menuWidth ? { minWidth: menuWidth } : {}),
    }),
  };
}

export interface AsyncSelectProps extends BaseSelectProps {
  loadOptions: (inputValue: string) => Promise<OptionType[]>;
  cacheOptions?: boolean;
  preIcon?: ReactNode;
  hideIconsOnOptions?: boolean;
}

function AsyncSelectPrimitive(_props: AsyncSelectProps) {
  const { hideIconsOnOptions, size, ...props } = _props;
  const styles = useStyles({
    ...props.styleConfig,
    size: size || 'default',
  });
  const [open, setOpen] = React.useState(false);
  const { isInDialog } = useDialogContext();

  const [menuPortalTarget, setMenuPortalTarget] =
    React.useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    if (isInDialog) {
      if (document.getElementById('dialog-dropdown-content')) {
        setMenuPortalTarget(document.getElementById('dialog-dropdown-content'));
      }
    } else {
      setMenuPortalTarget(document.body);
    }
  }, [isInDialog]);

  const [mounted, setMounted] = React.useState(false);

  const components = useSelectComponents(props);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadOptions = useDebouncedLoadOptions(props.loadOptions, 300);

  if (!mounted) {
    return <UnmountedSelect {..._props} />;
  }

  return (
    <SelectOptionsProvider
      value={{ hideIconsOnOptions, testId: props['data-testid'] }}
    >
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
        menuPortalTarget={menuPortalTarget}
        onChange={(value) => {
          props.onSelect?.(value);
        }}
        value={props.value}
        // @ts-expect-error yest
        components={components}
        styles={styles}
        classNames={getClassNames({
          size,
        })}
        {...props}
        loadOptions={loadOptions}
      />
    </SelectOptionsProvider>
  );
}

const unmountedSelectVariants = cva(
  'bg-background-grey min-w-[200px] min-h-biHeight',
  {
    variants: {
      size: {
        default: 'min-h-biHeight max-h-biHeight',
        large: 'min-h-biHeight-lg max-h-biHeight-lg',
        small: 'min-h-biHeight-sm max-h-biHeight-sm',
      },
    },
    defaultVariants: {},
  },
);

function UnmountedSelect(props: BaseSelectProps) {
  const { __use_rarely_className, size, fullWidth } = props;

  return (
    <VStack
      fullWidth={fullWidth}
      border
      className={cn(
        unmountedSelectVariants({
          size: size,
        }),
        __use_rarely_className,
      )}
    />
  );
}

export interface SelectProps extends BaseSelectProps {
  options: OptionType[];
  disabled?: boolean;
  hideIconsOnOptions?: boolean;
  fullWidth?: boolean;
  __use_rarely_className?: string;
}

function SelectPrimitive(_props: SelectProps) {
  const {
    hideIconsOnOptions,
    disabled,
    size,
    __use_rarely_className,
    ...props
  } = _props;
  const styles = useStyles({
    ...props.styleConfig,
    size: size || 'default',
  });
  const { isInDialog } = useDialogContext();
  const [open, setOpen] = React.useState(false);

  const [mounted, setMounted] = React.useState(false);

  const [menuPortalTarget, setMenuPortalTarget] =
    React.useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    if (isInDialog) {
      if (document.getElementById('dialog-dropdown-content')) {
        setMenuPortalTarget(document.getElementById('dialog-dropdown-content'));
      }
    } else {
      setMenuPortalTarget(document.body);
    }
  }, [isInDialog]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const components = useSelectComponents(props);

  if (!mounted) {
    return <UnmountedSelect {..._props} />;
  }

  return (
    <SelectOptionsProvider
      value={{ hideIconsOnOptions, testId: props['data-testid'] }}
    >
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
        isDisabled={disabled}
        className={__use_rarely_className}
        // menuIsOpen
        menuPortalTarget={menuPortalTarget}
        onChange={(value) => {
          props.onSelect?.(value);
        }}
        onMenuOpen={() => {
          setOpen(true);
        }}
        menuPlacement="auto"
        onMenuClose={() => {
          setOpen(false);
        }}
        menuIsOpen={open}
        value={props.value}
        // @ts-expect-error yest
        components={components}
        styles={styles}
        classNames={getClassNames({
          size,
        })}
        {...props}
      />
    </SelectOptionsProvider>
  );
}

function CreatableAsyncSelectPrimitive(_props: AsyncSelectProps) {
  const { hideIconsOnOptions, size, ...props } = _props;
  const styles = useStyles({
    ...props.styleConfig,
    size: size || 'default',
  });

  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const { isInDialog, portalId } = useDialogContext();

  const [menuPortalTarget, setMenuPortalTarget] =
    React.useState<HTMLElement | null>(null);
  const components = useSelectComponents(props);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    if (isInDialog) {
      if (document.getElementById(portalId)) {
        setMenuPortalTarget(document.getElementById(portalId));
      }
    } else {
      setMenuPortalTarget(document.body);
    }
  }, [isInDialog, portalId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadOptions = useDebouncedLoadOptions(props.loadOptions, 300);

  if (!mounted) {
    return <UnmountedSelect {..._props} />;
  }

  return (
    <SelectOptionsProvider
      value={{ hideIconsOnOptions, testId: props['data-testid'] }}
    >
      {props['data-testid'] && (
        <div
          className="absolute"
          onClick={() => {
            setOpen(true);
          }}
          data-testid={`${props['data-testid']}-trigger`}
        />
      )}
      <AsyncCreatableReactSelect
        unstyled
        onMenuOpen={() => {
          setOpen(true);
        }}
        onMenuClose={() => {
          setOpen(false);
        }}
        menuIsOpen={open}
        menuPortalTarget={menuPortalTarget}
        onChange={(value) => {
          props.onSelect?.(value);
        }}
        value={props.value}
        // @ts-expect-error yest
        components={components}
        styles={styles}
        classNames={getClassNames({
          size,
        })}
        {...props}
        loadOptions={loadOptions}
      />
    </SelectOptionsProvider>
  );
}

export const CreatableAsyncSelect = makeInput(
  CreatableAsyncSelectPrimitive,
  'CreatableAsyncSelect',
);

export const RawCreatableAsyncSelect = makeRawInput(
  CreatableAsyncSelectPrimitive,
  'RawCreatableAsyncSelect',
);

export const Select = makeInput(SelectPrimitive, 'Select');
export const RawSelect = makeRawInput(SelectPrimitive, 'RawSelect');
export const AsyncSelect = makeInput(AsyncSelectPrimitive, 'AsyncSelect');
export const RawAsyncSelect = makeRawInput(
  AsyncSelectPrimitive,
  'RawAsyncSelect',
);
