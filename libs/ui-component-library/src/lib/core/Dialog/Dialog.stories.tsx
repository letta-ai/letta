import type { Meta, StoryObj } from '@storybook/react';
import { Dialog, DialogContentWithCategories } from './Dialog';
import { Button } from '../Button/Button';
import { PlusIcon } from '../../icons';
import { FormProvider, FormField, useForm } from '../Form/Form';
import { Input } from '../Input/Input';
import { Typography } from '../Typography/Typography';
import { VStack } from '../../framing/VStack/VStack';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const meta: Meta<typeof Dialog> = {
  component: Dialog,
  title: 'core/Dialog',
};

export default meta;
type Story = StoryObj<typeof Dialog>;

export const Primary: Story = {
  argTypes: {
    isOpen: {
      control: {
        type: 'boolean',
      },
    },
    onOpenChange: {},
    trigger: {},
    title: {
      control: {
        type: 'text',
      },
    },
    children: {
      control: {
        type: 'text',
      },
    },
  },
  args: {
    title: 'Dialog Title',
    children: 'Dialog Content',
    trigger: <Button label="Open Dialog"></Button>,
  },
};

export const WithTypeToConfirm: Story = {
  render: () => {
    const confirmationText = 'DELETE';

    const TypeToConfirmSchema = z.object({
      confirmText: z.string().refine((val) => val === confirmationText, {
        message: 'Text must match exactly',
      }),
    });

    const form = useForm({
      resolver: zodResolver(TypeToConfirmSchema),
      defaultValues: {
        confirmText: '',
      },
    });

    const handleSubmit = () => {
      console.log('Confirmed!');
    };

    return (
      <FormProvider {...form}>
        <Dialog
          title="Delete Item"
          trigger={
            <Button label="Open Type-to-Confirm Dialog" color="destructive" />
          }
          onSubmit={form.handleSubmit(handleSubmit)}
          confirmText="Delete"
          confirmColor="destructive"
          disableSubmit={!form.formState.isValid}
        >
          <VStack fullWidth gap="form">
            <Typography>
              This action cannot be undone. Please type{' '}
              <strong>{confirmationText}</strong> to confirm.
            </Typography>
            <FormField
              name="confirmText"
              render={({ field }) => (
                <Input
                  fullWidth
                  placeholder={confirmationText}
                  label="Type to confirm"
                  {...field}
                />
              )}
            />
          </VStack>
        </Dialog>
      </FormProvider>
    );
  },
};

export const WithCategories: Story = {
  argTypes: {
    isOpen: {
      control: {
        type: 'boolean',
      },
    },
    onOpenChange: {},
    trigger: {},
    title: {
      control: {
        type: 'text',
      },
    },
    children: {
      control: {
        type: 'text',
      },
    },
  },
  args: {
    size: 'full',
    title: 'Dialog Title',
    children: (
      <DialogContentWithCategories
        categories={[
          {
            id: 'category',
            icon: <PlusIcon />,
            title: 'Category 1',
            subtitle: 'Test',
            children: 'Category 1 Content',
          },
          {
            id: 'category2',
            title: 'Category 2',
            subtitle: 'test',
            children: 'Category 2 Content',
          },
          {
            id: 'category3',
            title: 'Category 3',
            children: 'Category 3 Content',
          },
        ]}
      />
    ),
    trigger: <Button label="Open Dialog"></Button>,
  },
};
