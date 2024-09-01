'use client';

import * as React from 'react';
import * as RadixLabelPrimitive from '@radix-ui/react-label';
import { Slot } from '@radix-ui/react-slot';
import type { ControllerProps, FieldPath, FieldValues } from 'react-hook-form';
import { Controller, FormProvider, useFormContext } from 'react-hook-form';

import { cn } from '@letta-web/core-style-config';
import { cva, type VariantProps } from 'class-variance-authority';

export { useForm } from 'react-hook-form';

const Form = FormProvider;

const labelVariants = cva(
  'text-base font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
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
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
  name: TName;
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
);

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
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

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
  {} as FormItemContextValue
);

const InputWrapper = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('flex flex-col gap-[6px]', className)}
      {...props}
    />
  );
});

const FormItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const id = React.useId();

  return (
    <FormItemContext.Provider value={{ id }}>
      <InputWrapper ref={ref} className={className} {...props} />
    </FormItemContext.Provider>
  );
});

export function RawFormItem(props: React.HTMLAttributes<HTMLDivElement>) {
  return <InputWrapper {...props} />;
}

export interface InputContainerProps {
  label: string;
  hideLabel?: boolean;
  description?: string;
  children: React.ReactNode;
}

export function InputContainer(props: InputContainerProps) {
  const { label, hideLabel, description, children } = props;

  return (
    <FormItem>
      <FormLabel className={hideLabel ? 'sr-only' : ''}>{label}</FormLabel>
      <FormControl>{children}</FormControl>
      {description && <FormDescription>{description}</FormDescription>}
      <FormMessage />
    </FormItem>
  );
}

export interface RawInputContainerProps extends InputContainerProps {
  id: string;
}

export function RawInputContainer(props: RawInputContainerProps) {
  return (
    <InputWrapper>
      <LabelPrimitive
        htmlFor={props.id}
        className={props.hideLabel ? 'sr-only' : ''}
      >
        {props.label}
      </LabelPrimitive>
      {props.children}
    </InputWrapper>
  );
}

type MakeInputProps<T> = InputContainerProps & T;
type MakeRawInputProps<T> = RawInputContainerProps & T;

export function makeInput<T>(
  Input: React.ComponentType<T>,
  componentName: string
) {
  function InputWrapper(props: MakeInputProps<T>) {
    return (
      <InputContainer {...props}>
        <Input {...props} />
      </InputContainer>
    );
  }

  InputWrapper.displayName = componentName;

  return InputWrapper;
}

export function makeRawInput<T>(
  Input: React.ComponentType<T>,
  componentName: string
) {
  function RawInputWrapper(props: MakeRawInputProps<T>) {
    return (
      <RawInputContainer {...props}>
        <Input {...props} />
      </RawInputContainer>
    );
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
    <p id={id} className="text-[0.8rem] text-muted-foreground">
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
      className={cn('text-[0.8rem] font-medium text-destructive', className)}
      {...props}
    >
      {body}
    </p>
  );
});
FormMessage.displayName = 'FormMessage';

export { useFormField, Form, FormControl, FormField };
