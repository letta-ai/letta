import type { PropsWithChildren, ElementType } from 'react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { FormField, FormProvider } from '../../lib/core/Form/Form';
import { Alert } from '../../lib/core/Alert/Alert';

type WrapWithFormContextProps = PropsWithChildren<{
  alternativeText?: string;
}>;

function WrapWithFormContextComponent(props: WrapWithFormContextProps) {
  const { alternativeText } = props;
  const form = useForm();

  return (
    <FormProvider {...form}>
      <form className={'flex flex-col gap-3'}>
        <Alert
          title={`  This component requires you to wrap it with a Form component, it wont
        work by itself.`}
          variant="warning"
        >
          {alternativeText}
        </Alert>
        <FormField
          control={form.control}
          name="username"
          render={() => <span>{props.children}</span>}
        />
      </form>
    </FormProvider>
  );
}

interface WrapWithFormContextOptions {
  alternativeText?: string;
}

export function generateWrapWithFormContext(
  options: WrapWithFormContextOptions,
) {
  return function wrapWithFormContextDecorator(Story: ElementType) {
    return (
      <WrapWithFormContextComponent alternativeText={options.alternativeText}>
        <Story />
      </WrapWithFormContextComponent>
    );
  };
}
