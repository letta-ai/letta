'use client';

import * as React from 'react';
import * as RadixLabelPrimitive from '@radix-ui/react-label';
import { Slot } from '@radix-ui/react-slot';
import type { ControllerProps, FieldPath, FieldValues } from 'react-hook-form';
import { Controller, FormProvider, useFormContext } from 'react-hook-form';

import { cn } from '@letta-cloud/ui-styles';
import { cva, type VariantProps } from 'class-variance-authority';
import type { PropsWithChildren } from 'react';
import { useId, useMemo } from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { Typography, type TypographyProps } from '../Typography/Typography';
import type { ArgTypes } from '@storybook/csf';
import { omit } from 'lodash-es';
import { InfoTooltip } from '../../reusable/InfoTooltip/InfoTooltip';

export { useForm } from 'react-hook-form';

const labelVariants = cva(
  'text-base font-medium text-left leading-none small:whitespace-nowrap peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
);

const LabelPrimitive = React.forwardRef<
  React.ElementRef<typeof RadixLabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadixLabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <RadixLabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
));
LabelPrimitive.displayName = RadixLabelPrimitive.Root.displayName;

interface FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  name: TName;
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue,
);

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

function useFormField() {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  const fieldState = getFieldState(fieldContext.name, formState);

  if (!fieldContext) {
    throw new Error('useFormField should be used within <FormField>');
  }

  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
}

interface FormItemContextValue {
  id: string;
}

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue,
);

interface InputWrapperProps {
  inline?: boolean | 'reverse';
  fullWidth?: boolean;
  fullHeight?: boolean;
  flex?: boolean;
  inputAndLabel: React.ReactNode;
  collapseHeight?: boolean;
  otherContent: React.ReactNode;
}

function InputWrapper({
  inline,
  fullWidth,
  collapseHeight,
  flex,
  fullHeight,
  inputAndLabel,
  otherContent,
}: InputWrapperProps) {
  const className = useMemo(() => {
    return cn(
      'flex flex-col gap-[5px]',
      collapseHeight ? 'h-0' : '',
      fullWidth ? 'w-full' : 'w-fit',
      fullHeight ? 'h-full' : '',
      flex ? 'flex-1' : '',
    );
  }, [collapseHeight, flex, fullHeight, fullWidth]);

  if (inline) {
    return (
      <div className={className}>
        <div
          className={cn(
            'flex flex-wrap pt-2 sm:pt-0 sm:flex-nowrap gap-2 justify-between items-center',
            inline === 'reverse' && 'flex-row-reverse justify-end',
          )}
        >
          {inputAndLabel}
        </div>
        {otherContent && <div>{otherContent}</div>}
      </div>
    );
  }

  return (
    <div className={className}>
      {inputAndLabel}
      {otherContent}
    </div>
  );
}

interface FormItemProps {
  children: React.ReactNode;
}

function FormItem({ children }: FormItemProps) {
  const id = React.useId();

  return (
    <FormItemContext.Provider value={{ id }}>
      {children}
    </FormItemContext.Provider>
  );
}

interface InputContainerHeaderProps {
  preLabelIcon?: React.ReactNode;
  labelBadge?: React.ReactNode;
  labelFontVariant?: TypographyProps['variant'];
  infoTooltip?: {
    text: string;
  };
  label: string;
}

function InputContainerHeader(props: InputContainerHeaderProps) {
  const { preLabelIcon, labelBadge, label, labelFontVariant, infoTooltip } =
    props;

  return (
    <HStack>
      <HStack gap="small" align="center">
        {preLabelIcon && <Slot className="h-3">{preLabelIcon}</Slot>}
        <Typography
          align="left"
          variant={labelFontVariant || 'body3'}
          semibold
          color={'lighter'}
        >
          {label}
        </Typography>
        {labelBadge}
      </HStack>
      {infoTooltip && <InfoTooltip text={infoTooltip.text} />}
    </HStack>
  );
}

export interface InputContainerProps {
  label: string;
  ref?: any;
  labelFontVariant?: 'body' | 'body2' | 'body3' | 'body4';
  preLabelIcon?: React.ReactNode;
  labelBadge?: React.ReactNode;
  hideInput?: boolean;
  hideLabel?: boolean;
  description?: React.ReactNode | string;
  inline?: boolean | 'reverse';
  fullWidth?: boolean;
  fullHeight?: boolean;
  collapseHeight?: boolean;
  rightOfLabelContent?: React.ReactNode;
  infoTooltip?: {
    text: string;
  };
  flex?: boolean;
  children?: React.ReactNode;
}

export function InputContainer(props: InputContainerProps) {
  const {
    label,
    hideLabel,
    preLabelIcon,
    fullWidth,
    fullHeight,
    labelBadge,
    flex,
    description,
    inline,
    labelFontVariant,
    rightOfLabelContent,
    infoTooltip,
    children,
  } = props;
  return (
    <FormItem>
      <InputWrapper
        fullWidth={fullWidth}
        fullHeight={fullHeight}
        inline={inline}
        flex={flex}
        inputAndLabel={
          <>
            <HStack
              className={hideLabel ? 'sr-only' : ''}
              fullWidth
              gap="text"
              justify="spaceBetween"
            >
              <FormLabel>
                <InputContainerHeader
                  preLabelIcon={preLabelIcon}
                  labelFontVariant={labelFontVariant}
                  labelBadge={labelBadge}
                  label={label}
                  infoTooltip={infoTooltip}
                />
              </FormLabel>
              {rightOfLabelContent}
            </HStack>
            <FormControl>{children}</FormControl>
          </>
        }
        otherContent={
          <>
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </>
        }
      />
    </FormItem>
  );
}

export interface RawInputContainerProps extends InputContainerProps {
  id?: string;
  errorMessage?: string;
}

export function RawInputContainer(props: RawInputContainerProps) {
  const {
    label,
    id,
    hideLabel,
    fullHeight,
    hideInput = false,
    labelBadge,
    flex,
    inline,
    fullWidth,
    labelFontVariant,
    errorMessage,
    preLabelIcon,
    collapseHeight,
    description,
    children,
    infoTooltip,
    rightOfLabelContent,
  } = props;

  return (
    <InputWrapper
      fullWidth={fullWidth}
      fullHeight={fullHeight}
      collapseHeight={collapseHeight}
      flex={flex}
      inputAndLabel={
        <>
          <HStack
            fullWidth
            className={hideLabel ? 'sr-only' : ''}
            gap="text"
            justify="spaceBetween"
          >
            <LabelPrimitive
              htmlFor={id}
              className="flex flex-row gap-1 items-center"
            >
              <InputContainerHeader
                preLabelIcon={preLabelIcon}
                labelBadge={labelBadge}
                labelFontVariant={labelFontVariant}
                label={label}
                infoTooltip={infoTooltip}
              />
            </LabelPrimitive>
            {rightOfLabelContent}
          </HStack>
          {!hideInput && children}
        </>
      }
      otherContent={
        <>
          {errorMessage && (
            <Typography color="destructive" variant="body3">
              {errorMessage}
            </Typography>
          )}
          {description && (
            <RawFormDescription id={id || ''}>{description}</RawFormDescription>
          )}
        </>
      }
      inline={inline}
    ></InputWrapper>
  );
}

export type MakeInputProps<T> = InputContainerProps & T;
type MakeRawInputProps<T> = RawInputContainerProps & T;

export type MakeInputOptionsContainerType = (
  props: PropsWithChildren<InputContainerProps>,
) => React.ReactNode;

interface MakeInputOptions {
  inline?: boolean | 'reverse';
  fullWidth?: boolean;
  container?: MakeInputOptionsContainerType;
}

const omitProps = [
  'rightOfLabelContent',
  'infoTooltip',
  'errorMessage',
  'labelFontVariant',
  'labelBadge',
];

export function makeInput<T>(
  Input: React.ComponentType<T>,
  componentName: string,
  options?: MakeInputOptions,
) {
  function InputWrapper(props: MakeInputProps<T>) {
    const el = (
      <InputContainer
        {...props}
        inline={options?.inline}
        fullWidth={props.fullWidth || options?.fullWidth}
      >
        <Input ref={props.ref} {...(omit(props, omitProps) as typeof props)} />
      </InputContainer>
    );

    return options?.container
      ? options.container({ children: el, ...props })
      : el;
  }

  InputWrapper.displayName = componentName;

  return InputWrapper;
}

export const inputStorybookArgTypes: ArgTypes = {
  label: { control: 'text' },
  hideLabel: { control: 'boolean' },
  description: { control: 'text' },
  fullWidth: { control: 'boolean' },
  fullHeight: { control: 'boolean' },
};
export const inputStorybookArgs = {
  label: 'Label',
  hideLabel: false,
  description: '',
  fullWidth: false,
  collapseHeight: false,
  fullHeight: false,
};

export function extractAndRemoveInputProps<T>(
  props: T & {
    label?: string;
    hideInput?: boolean;
    hideLabel?: boolean;
    infoTooltipText?: string;
  },
) {
  const { label, hideLabel, hideInput, infoTooltipText, ...rest } = props;
  return rest;
}

export function makeRawInput<T>(
  Input: React.ComponentType<T>,
  componentName: string,
  options?: MakeInputOptions,
) {
  function RawInputWrapper(props: MakeRawInputProps<T>) {
    const baseId = useId();

    const el = (
      <RawInputContainer
        {...props}
        id={baseId || props.id}
        inline={options?.inline || props.inline}
        collapseHeight={props.collapseHeight}
        fullWidth={props.fullWidth || options?.fullWidth}
      >
        <Input {...(omit(props, omitProps) as typeof props)} />
      </RawInputContainer>
    );

    return options?.container
      ? options.container({ children: el, ...props })
      : el;
  }

  RawInputWrapper.displayName = componentName;

  return RawInputWrapper;
}

FormItem.displayName = 'FormItem';

const FormLabel = React.forwardRef<
  React.ElementRef<typeof RadixLabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadixLabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField();

  return (
    <LabelPrimitive
      ref={ref}
      className={cn(error && 'text-destructive', className)}
      htmlFor={formItemId}
      {...props}
    />
  );
});
FormLabel.displayName = 'FormLabel';

const FormControl = React.forwardRef<
  React.ElementRef<typeof Slot>,
  React.ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId } =
    useFormField();

  return (
    <Slot
      ref={ref}
      id={formItemId}
      aria-describedby={
        !error ? formDescriptionId : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  );
});
FormControl.displayName = 'FormControl';

interface RawFormDescriptionProps {
  children: React.ReactNode;
  id: string;
}

function RawFormDescription(props: RawFormDescriptionProps) {
  const { children, id } = props;

  return (
    <p id={id} className="text-[0.8rem] text-left text-muted-content">
      {children}
    </p>
  );
}

function FormDescription(props: Omit<RawFormDescriptionProps, 'id'>) {
  const { children } = props;
  const { formDescriptionId } = useFormField();

  return (
    <RawFormDescription id={formDescriptionId}>{children}</RawFormDescription>
  );
}

FormDescription.displayName = 'FormDescription';

const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error.message) : children;

  if (!body) {
    return null;
  }

  return (
    <p
      ref={ref}
      id={formMessageId}
      className={cn(
        'text-[0.8rem] font-medium text-destructive text-left',
        className,
      )}
      {...props}
    >
      {body}
    </p>
  );
});
FormMessage.displayName = 'FormMessage';

type FormActionsProps = PropsWithChildren<{
  errorMessage?: React.ReactNode;
  align?: 'end' | 'start';
}>;

export function FormActions({
  children,
  errorMessage,
  align = 'end',
}: FormActionsProps) {
  return (
    <div
      className={cn(
        'flex gap-4 w-full justify-between',
        align === 'start' ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      {errorMessage ? (
        <Typography align="left" color="destructive">
          {errorMessage}
        </Typography>
      ) : (
        <div />
      )}
      <HStack align="center" reverse={align === 'start'}>
        {children}
      </HStack>
    </div>
  );
}

const formVariants = cva('contents', {
  variants: {
    variant: {
      contained: 'flex flex-col gap-6 w-full max-w-[610px]',
      dashboard: 'flex flex-col gap-4 w-full max-w-[360px]',
    },
  },
  defaultVariants: {},
});

type FormProps = React.HTMLAttributes<HTMLFormElement> &
  VariantProps<typeof formVariants>;

function Form(props: FormProps) {
  const { variant, ...rest } = props;
  return <form {...rest} className={cn(formVariants({ variant }))} />;
}

export { useFormField, Form, FormProvider, FormControl, FormField };
