import React, { useCallback, useMemo, useState } from 'react';
import {
  Button,
  createPageRouter,
  DataTable,
  Dialog,
  Form,
  FormActions,
  FormField,
  FormProvider,
  Input,
  PanelBar,
  RawInput,
  ToggleGroup,
  useForm,
  VStack,
} from '@letta-web/component-library';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { zodResolver } from '@hookform/resolvers/zod';

const { PanelRouter, usePanelRouteData, usePanelPageContext } =
  createPageRouter(
    {
      editVariable: {
        title: 'Edit Variable',
        state: z.object({
          variableId: z.string(),
        }),
      },
      variableHome: {
        title: 'Variables',
        state: z.object({}),
      },
    },
    {
      initialPage: 'variableHome',
    }
  );

interface TempVariableType {
  key: string;
  description: string;
  defaultValue: string | null;
  type: 'SYSTEM' | 'USER';
  scope: 'AGENT' | 'PROJECT';
}

const tempVariables: TempVariableType[] = [
  {
    key: 'CURRENT_TIME',
    description: 'The current time',
    defaultValue: null,
    type: 'SYSTEM',
    scope: 'AGENT',
  },
  {
    key: 'USER_NAME',
    description: 'The name of the user',
    defaultValue: null,
    type: 'USER',
    scope: 'AGENT',
  },
  {
    key: 'COMPANY_NAME',
    description: 'The name of our company',
    defaultValue: 'Letta',
    type: 'USER',
    scope: 'PROJECT',
  },
];

const createVariableFormSchema = z.object({
  // alphanumeric, underscores, and dashes, cannot start with a number
  key: z
    .string()
    .regex(
      /^[a-zA-Z_][a-zA-Z0-9_-]*$/,
      'Key must be alphanumeric, and can only contain underscores and dashes'
    ),
  description: z.string(),
  defaultValue: z.string().nullable(),
  scope: z.enum(['AGENT', 'PROJECT']),
});

function CreateVariableModal() {
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<z.infer<typeof createVariableFormSchema>>({
    resolver: zodResolver(createVariableFormSchema),
    defaultValues: {
      key: '',
      description: '',
      defaultValue: '',
      scope: 'AGENT',
    },
  });

  const handleSubmit = useCallback(
    (e: z.infer<typeof createVariableFormSchema>) => {
      console.log(e);
    },
    []
  );

  return (
    <FormProvider {...form}>
      <Dialog
        onOpenChange={setIsOpen}
        isOpen={isOpen}
        title="Create Variable"
        confirmText="Create"
        onSubmit={form.handleSubmit(handleSubmit)}
        cancelText="Cancel"
        trigger={
          <Button size="small" color="primary" label="Create Variable" />
        }
      >
        <VStack gap="form">
          <FormField
            name="scope"
            render={({ field }) => (
              <ToggleGroup
                items={[
                  {
                    label: 'Agent',
                    value: 'AGENT',
                  },
                  {
                    label: 'Project',
                    value: 'PROJECT',
                  },
                ]}
                description="Choose whether this variable is scoped to the Agent or the Project. If scoped to the Project, all Agents will have access to this variable, meaning if you "
                fullWidth
                label="Scope"
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                }}
              />
            )}
          />
          <FormField
            name="key"
            render={({ field }) => (
              <Input
                required
                description="This cannot be changed once created"
                fullWidth
                label="Key"
                {...field}
              />
            )}
          />
          <FormField
            name="description"
            render={({ field }) => (
              <Input fullWidth label="Description" {...field} />
            )}
          />
          <FormField
            name="defaultValue"
            render={({ field }) => (
              <Input
                fullWidth
                description="This is the default value if no value is set for an Agent"
                label="Default Value"
                {...field}
              />
            )}
          />
        </VStack>
      </Dialog>
    </FormProvider>
  );
}

function VariableHome() {
  const [search, setSearch] = useState('');
  const { setCurrentPage } = usePanelPageContext();

  const variableTableColumns: Array<ColumnDef<TempVariableType>> =
    useMemo(() => {
      return [
        {
          header: 'Key',
          accessorKey: 'key',
        },
        {
          header: 'Description',
          accessorKey: 'description',
        },
        {
          header: 'Default Value',
          accessorKey: 'defaultValue',
        },
        {
          header: 'Type',
          accessorKey: 'type',
        },
        {
          header: 'Scope',
          accessorKey: 'scope',
        },
        {
          accessorKey: 'key',
          header: '',
          id: 'actions',
          cell: (cell) => {
            if (cell.row.original.type === 'SYSTEM') {
              return null;
            }

            return (
              <Button
                label="Edit"
                color="tertiary"
                size="small"
                onClick={() => {
                  setCurrentPage('editVariable', {
                    variableId: cell.getValue(),
                  });
                }}
              />
            );
          },
        },
      ];
    }, [setCurrentPage]);

  return (
    <>
      <PanelBar
        onSearch={(value) => {
          setSearch(value);
        }}
        searchValue={search}
        actions={<CreateVariableModal />}
      />
      <DataTable
        columns={variableTableColumns}
        variant="minimal"
        data={tempVariables}
      />
    </>
  );
}

const editVariableFormSchema = z.object({
  description: z.string(),
  defaultValue: z.string().nullable(),
});

function DeleteVariableDialog() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog
      onOpenChange={setIsOpen}
      isOpen={isOpen}
      title="Delete Variable"
      confirmColor="destructive"
      trigger={<Button label="Delete Variable" color="destructive" />}
      confirmText="Delete"
      onConfirm={() => {
        console.log('Delete');
      }}
      cancelText="Cancel"
    >
      Are you sure you want to delete this variable? This cannot be undone.
    </Dialog>
  );
}

function EditVariable() {
  const { variableId } = usePanelRouteData<'editVariable'>();
  const { setCurrentPage } = usePanelPageContext();

  const currentVariable = tempVariables.find(
    (variable) => variable.key === variableId
  );

  if (!currentVariable) {
    throw new Error('Variable not found');
  }

  const form = useForm({
    resolver: zodResolver(editVariableFormSchema),
    defaultValues: {
      description: '',
      defaultValue: '',
    },
  });

  return (
    <FormProvider {...form}>
      <VStack padding gap="form">
        <Form>
          <RawInput
            fullWidth
            label="Key"
            value={currentVariable.key}
            disabled
          />
          <FormField
            name="description"
            render={({ field }) => (
              <Input fullWidth label="Description" {...field} />
            )}
          />
          <FormField
            name="defaultValue"
            render={({ field }) => (
              <Input
                fullWidth
                description="This is the default value if no value is set for an Agent"
                label="Default Value"
                {...field}
              />
            )}
          />
          <RawInput
            fullWidth
            label="Scope"
            value={currentVariable.scope}
            disabled
          />
          <FormActions startAction={<DeleteVariableDialog />}>
            <Button
              color="tertiary"
              label="Cancel"
              onClick={() => {
                setCurrentPage('variableHome');
              }}
            />
            <Button label="Update Variable" type="submit" />
          </FormActions>
        </Form>
      </VStack>
    </FormProvider>
  );
}

export function VariablesPanel() {
  return (
    <>
      <PanelRouter
        rootPageKey="variableHome"
        pages={{
          variableHome: <VariableHome />,
          editVariable: <EditVariable />,
        }}
      />
    </>
  );
}
