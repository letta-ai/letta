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
  Input,
  LoadingEmptyStatusComponent,
  RawCodeEditor,
  Typography,
  useForm,
  VStack,
} from '@letta-web/component-library';
import { webApi } from '$web/client';
import type { AdminInferenceModelType } from '$web/web-api/admin/models/adminModelsContracts';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { queryClientKeys } from '$web/web-api/contracts';
import { useQueryClient } from '@tanstack/react-query';

interface InferenceModelPageProps {
  params: Promise<{
    modelId: string;
  }>;
}

interface UpdateInferenceModelFormProps {
  model: AdminInferenceModelType;
}

const updateInferenceModelSchema = z.object({
  name: z.string(),
  disabled: z.boolean(),
  isRecommended: z.boolean().optional(),
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
            model.id
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
    },
  });

  const handleSubmit = useCallback(
    (values: UpdateInferenceModelFormValues) => {
      mutate({
        params: {
          id: model.id,
        },
        body: {
          name: values.name,
          disabled: values.disabled,
          brand: values.brand,
          isRecommended: values.isRecommended,
          tag: values.tag,
        },
      });
    },
    [model, mutate]
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
              <Button busy={isPending} type="submit" label="Update" />
            </FormActions>
          </VStack>
        </VStack>
      </Form>
    </FormProvider>
  );
}

async function InferenceModelPage(props: InferenceModelPageProps) {
  const { params } = props;
  const { modelId } = await params;

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
