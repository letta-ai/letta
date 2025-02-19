'use client';
import React, { useCallback } from 'react';
import {
  BrandDropdown,
  Button,
  Checkbox,
  DashboardPageLayout,
  DashboardPageSection,
  Form,
  FormActions,
  FormField,
  FormProvider,
  HStack,
  Input,
  LoadingEmptyStatusComponent,
  RawCodeEditor,
  RawInput,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/component-library';
import { webApi } from '$web/client';
import type { AdminInferenceModelType } from '$web/web-api/contracts';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { queryClientKeys } from '$web/web-api/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import type { StepCostSchemaVersionOneStep } from '@letta-cloud/types';
import { parseInt } from 'lodash-es';

interface UpdateInferenceModelFormProps {
  model: AdminInferenceModelType;
}

const updateInferenceModelSchema = z.object({
  name: z.string(),
  disabled: z.boolean(),
  isRecommended: z.boolean().optional(),
  defaultRequestsPerMinutePerOrganization: z.coerce.number().positive(),
  defaultTokensPerMinutePerOrganization: z.coerce.number().positive(),
  defaultContextWindow: z.string().regex(/^\d+$/, {
    message: 'Context Window must be a positive integer',
  }),
  tag: z.string().optional(),
  brand: z.string(),
});

type UpdateInferenceModelFormValues = z.infer<
  typeof updateInferenceModelSchema
>;

function UpdateInferenceModelForm(props: UpdateInferenceModelFormProps) {
  const { model } = props;
  const queryClient = useQueryClient();
  const { mutate, isPending } =
    webApi.admin.models.updateAdminInferenceModel.useMutation({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: queryClientKeys.admin.models.getAdminInferenceModelById(
            model.id,
          ),
        });
        void queryClient.invalidateQueries({
          queryKey: queryClientKeys.admin.models.getAdminInferenceModels,
          exact: false,
        });
      },
    });

  const form = useForm<UpdateInferenceModelFormValues>({
    resolver: zodResolver(updateInferenceModelSchema),
    defaultValues: {
      name: model.name,
      disabled: !!model.disabledAt,
      brand: model.brand,
      defaultRequestsPerMinutePerOrganization:
        model.defaultRequestsPerMinutePerOrganization,
      defaultTokensPerMinutePerOrganization:
        model.defaultTokensPerMinutePerOrganization,
      defaultContextWindow: model.defaultContextWindow
        ? model.defaultContextWindow.toString()
        : '',
    },
  });

  const handleSubmit = useCallback(
    (values: UpdateInferenceModelFormValues) => {
      mutate({
        params: {
          id: model.id,
        },
        body: {
          defaultRequestsPerMinutePerOrganization:
            values.defaultRequestsPerMinutePerOrganization,
          defaultTokensPerMinutePerOrganization:
            values.defaultTokensPerMinutePerOrganization,
          defaultContextWindow: parseInt(values.defaultContextWindow, 10),
          name: values.name,
          disabled: values.disabled,
          brand: values.brand,
          isRecommended: values.isRecommended,
          tag: values.tag,
        },
      });
    },
    [model, mutate],
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <VStack>
          <VStack paddingBottom borderBottom gap="form">
            <FormField
              name="name"
              render={({ field }) => (
                <Input fullWidth label="Display Name" {...field} />
              )}
            />
            <FormField
              name="tag"
              render={({ field }) => (
                <Input
                  fullWidth
                  description="This is shown to the right of the model name in the model selection dropdown"
                  label="Tag"
                  {...field}
                />
              )}
            />
            <FormField
              name="defaultRequestsPerMinutePerOrganization"
              render={({ field }) => (
                <Input
                  {...field}
                  fullWidth
                  type="number"
                  label="RPM Limit (per Org)"
                  data-testid="rpm-limit"
                />
              )}
            />
            <FormField
              name="defaultTokensPerMinutePerOrganization"
              render={({ field }) => (
                <Input
                  {...field}
                  fullWidth
                  type="number"
                  label="TPM Limit (per Org)"
                  data-testid="tpm-limit"
                />
              )}
            />
            <FormField
              name="defaultContextWindow"
              render={({ field }) => (
                <Input
                  fullWidth
                  label="Default Context Window Size"
                  {...field}
                />
              )}
            />
            <FormField
              name="brand"
              render={({ field }) => (
                <BrandDropdown
                  onChange={(value) => {
                    field.onChange(value);
                  }}
                  value={field.value}
                />
              )}
            />
            <VStack border paddingTop="large" padding="medium" fullWidth>
              <FormField
                name="isRecommended"
                render={({ field }) => (
                  <Checkbox
                    label="Recommended"
                    onCheckedChange={(checked) => {
                      field.onChange(checked);
                    }}
                    checked={field.value}
                  />
                )}
              />
            </VStack>

            <VStack border paddingTop="large" padding="medium" fullWidth>
              <FormField
                name="disabled"
                render={({ field }) => (
                  <Checkbox
                    label="Hidden from users"
                    onCheckedChange={(checked) => {
                      field.onChange(checked);
                    }}
                    checked={field.value}
                  />
                )}
              />
            </VStack>
            <FormActions>
              <Button
                data-testid="save-model"
                busy={isPending}
                type="submit"
                label="Update"
              />
            </FormActions>
          </VStack>
        </VStack>
      </Form>
    </FormProvider>
  );
}

const stepItemSchema = z.object({
  maxContextWindowSize: z.string().regex(/^\d+$/, {
    message: 'Max Context Window Size must be a positive integer',
  }),
  cost: z
    .string()
    .regex(/^\d+$/, { message: 'Cost must be a positive integer' }),
});

type StepItem = z.infer<typeof stepItemSchema>;

interface StepCostsEditorProps {
  steps: StepItem[];
  onUpdate: (steps: StepItem[]) => void;
}

function StepCostsEditor(props: StepCostsEditorProps) {
  const { steps, onUpdate } = props;

  const formState = useForm();

  const errorMessage = formState.formState.errors?.stepCosts?.message;

  const handleUpdate = useCallback(
    (index: number, key: keyof StepCostSchemaVersionOneStep, value: string) => {
      const newSteps = [...steps];
      newSteps[index] = {
        ...newSteps[index],
        [key]: value,
      };
      onUpdate(newSteps);
    },
    [steps, onUpdate],
  );

  const handleRemoveStep = useCallback(
    (index: number) => {
      onUpdate(steps.filter((_, i) => i !== index));
    },
    [steps, onUpdate],
  );

  const handleAddStep = useCallback(() => {
    onUpdate([...steps, { maxContextWindowSize: '0', cost: '0' }]);
  }, [steps, onUpdate]);

  return (
    <VStack>
      {steps.map((step, index) => {
        const error = stepItemSchema.safeParse(step).error;

        return (
          <VStack key={index}>
            <HStack align="end">
              <RawInput
                fullWidth
                label="Max Context Window Size"
                value={step.maxContextWindowSize}
                onChange={(e) => {
                  handleUpdate(index, 'maxContextWindowSize', e.target.value);
                }}
              />
              <RawInput
                fullWidth
                label="Cost"
                value={step.cost}
                onChange={(e) => {
                  handleUpdate(index, 'cost', e.target.value);
                }}
              />
              <Button
                label="Remove"
                color="secondary"
                onClick={() => {
                  handleRemoveStep(index);
                }}
              />
            </HStack>
            {error && (
              <Typography color="destructive">{error.message}</Typography>
            )}
          </VStack>
        );
      })}
      <Button type="button" label="Add Step" onClick={handleAddStep} />
      {typeof errorMessage === 'string' && (
        <Typography>{errorMessage}</Typography>
      )}
    </VStack>
  );
}

interface StepCostsFormProps {
  defaultValues: StepCostSchemaVersionOneStep[];
}

const stepCostsFormSchema = z.object({
  steps: z.array(stepItemSchema),
});

type StepCostsFormValues = z.infer<typeof stepCostsFormSchema>;

function StepCostsForm(props: StepCostsFormProps) {
  const { modelId } = useParams<{ modelId: string }>();

  const { defaultValues } = props;
  const form = useForm<StepCostsFormValues>({
    resolver: zodResolver(stepCostsFormSchema),
    defaultValues: {
      steps: defaultValues.map((step) => ({
        maxContextWindowSize: step.maxContextWindowSize.toString(),
        cost: step.cost.toString(),
      })),
    },
  });
  const queryClient = useQueryClient();

  const { mutate, isPending } = webApi.admin.models.updateStepCosts.useMutation(
    {
      onSuccess: (nextCosts) => {
        void queryClient.setQueriesData(
          {
            queryKey: queryClientKeys.admin.models.getStepCosts(modelId),
          },
          () => nextCosts,
        );
      },
    },
  );

  const handleSubmit = useCallback(
    (values: StepCostsFormValues) => {
      mutate({
        params: {
          id: modelId,
        },
        body: {
          version: '1',
          data: values.steps
            .toSorted(
              (a, b) =>
                parseInt(a.maxContextWindowSize) -
                parseInt(b.maxContextWindowSize),
            )
            .map((step) => ({
              maxContextWindowSize: parseInt(step.maxContextWindowSize),
              cost: parseInt(step.cost),
            })),
        },
      });
    },
    [modelId, mutate],
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <VStack>
          <VStack paddingBottom borderBottom gap="form">
            <FormField
              name="steps"
              render={({ field }) => {
                return (
                  <StepCostsEditor
                    steps={field.value}
                    onUpdate={field.onChange}
                  />
                );
              }}
            />
            <FormActions>
              <Button busy={isPending} type="submit" label="Update" />
            </FormActions>
          </VStack>
        </VStack>
      </Form>
    </FormProvider>
  );
}

function StepCostsManager() {
  const { modelId } = useParams<{ modelId: string }>();

  const {
    data: stepCosts,
    isLoading,
    isError,
  } = webApi.admin.models.getStepCosts.useQuery({
    queryKey: queryClientKeys.admin.models.getStepCosts(modelId),
    queryData: {
      params: {
        id: modelId,
      },
    },
  });

  return (
    <DashboardPageSection title="Step Costs">
      {!stepCosts ? (
        <LoadingEmptyStatusComponent
          emptyMessage=""
          isLoading={isLoading}
          isError={isError}
          errorMessage="Failed to load step costs"
        />
      ) : (
        <StepCostsForm defaultValues={stepCosts.body.data} />
      )}
    </DashboardPageSection>
  );
}

function InferenceModelPage() {
  const { modelId } = useParams<{ modelId: string }>();

  const {
    data: model,
    isLoading,
    isError,
  } = webApi.admin.models.getAdminInferenceModel.useQuery({
    queryKey: queryClientKeys.admin.models.getAdminInferenceModelById(modelId),
    queryData: {
      params: {
        id: modelId,
      },
    },
    enabled: !!modelId,
  });

  return (
    <DashboardPageLayout
      encapsulatedFullHeight
      title={model?.body?.name ? `Editing Model` : 'Loading model...'}
    >
      <DashboardPageSection>
        {!model?.body ? (
          <LoadingEmptyStatusComponent
            emptyMessage=""
            isLoading={isLoading}
            isError={isError}
            errorMessage="Failed to load model"
          />
        ) : (
          <UpdateInferenceModelForm model={model.body} />
        )}
      </DashboardPageSection>
      <StepCostsManager />
      {model?.body?.config && (
        <DashboardPageSection title="Model Config">
          <Typography>
            View the model configuration, this is not editable here and only for
            your reference
          </Typography>
          <RawCodeEditor
            label=""
            fullWidth
            language="javascript"
            code={JSON.stringify(model.body?.config || '', null, 2)}
          />
        </DashboardPageSection>
      )}
    </DashboardPageLayout>
  );
}

export default InferenceModelPage;
