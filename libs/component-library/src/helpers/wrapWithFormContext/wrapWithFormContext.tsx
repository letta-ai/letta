import type { PropsWithChildren, ElementType } from 'react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { FormField, Form } from '../../lib/Form/Form';

type WrapWithFormContextProps = PropsWithChildren<Record<never, string>>;

function WrapWithFormContextComponent(props: WrapWithFormContextProps) {
  const form = useForm();

  return (
    <Form {...form}>
      <div className="bg-yellow-50 border-yellow-200 p-4 border rounded mb-4">
        This component requires you to wrap it with a Form component, it wont
        work by itself.
      </div>
      <FormField
        control={form.control}
        name="username"
        render={() => <span>{props.children}</span>}
      />
    </Form>
  );
}

export function wrapWithFormContext(Story: ElementType) {
  return (
    <WrapWithFormContextComponent>
      <Story />
    </WrapWithFormContextComponent>
  );
}
