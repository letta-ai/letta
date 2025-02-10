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
} from '@letta-cloud/component-library';
import { webApi } from '$web/client';
import type { AdminEmbeddingModelType } from '$web/web-api/contracts';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { queryClientKeys } from '$web/web-api/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';

interface UpdateEmbeddingModelFormProps {
  model: AdminEmbeddingModelType;
}

const updateEmbeddingModelSchema = z.object({
  name: z.string(),
  disabled: z.boolean(),
  brand: z.string(),
  defaultRequestsPerMinutePerOrganization: z.coerce.number().positive(),
  defaultTokensPerMinutePerOrganization: z.coerce.number().positive(),
});

type UpdateEmbeddingModelFormValues = z.infer<
  typeof updateEmbeddingModelSchema
>;

function UpdateEmbeddingModelForm(props: UpdateEmbeddingModelFormProps) {
  const { model } = props;
  const queryClient = useQueryClient();
  const { mutate, isPending } =
    webApi.admin.models.updateAdminEmbeddingModel.useMutation({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: queryClientKeys.admin.models.getAdminEmbeddingModelById(
            model.id,
          ),
        });
        void queryClient.invalidateQueries({
          queryKey: queryClientKeys.admin.models.getAdminEmbeddingModels,
          exact: false,
        });
      },
    });

  const form = useForm<UpdateEmbeddingModelFormValues>({
    resolver: zodResolver(updateEmbeddingModelSchema),
    defaultValues: {
      name: model.name,
      disabled: !!model.disabledAt,
      brand: model.brand,
      defaultRequestsPerMinutePerOrganization:
        model.defaultRequestsPerMinutePerOrganization,
      defaultTokensPerMinutePerOrganization:
        model.defaultTokensPerMinutePerOrganization,
    },
  });

  const handleSubmit = useCallback(
    (values: UpdateEmbeddingModelFormValues) => {
      mutate({
        params: {
          id: model.id,
        },
        body: {
          defaultRequestsPerMinutePerOrganization:
            values.defaultRequestsPerMinutePerOrganization,
          defaultTokensPerMinutePerOrganization:
            values.defaultTokensPerMinutePerOrganization,

          name: values.name,
          disabled: values.disabled,
          brand: values.brand,
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
            <FormField
              name="defaultRequestsPerMinutePerOrganization"
              render={({ field }) => (
                <Input
                  {...field}

                  fullWidth
                  type="number"
                  data-testid="rpm-limit"
                  label="RPM Limit (per Org)"
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
                  data-testid="tpm-limit"
                  label="TPM Limit (per Org)"
                />
              )}
            />
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
                busy={isPending} type="submit" label="Update" />
            </FormActions>
          </VStack>
        </VStack>
      </Form>
    </FormProvider>
  );
}

function EmbeddingModelPage() {
  const { modelId } = useParams<{ modelId: string }>();

  const {
    data: model,
    isLoading,
    isError,
  } = webApi.admin.models.getAdminEmbeddingModel.useQuery({
    queryKey: queryClientKeys.admin.models.getAdminEmbeddingModelById(modelId),
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
          <UpdateEmbeddingModelForm model={model.body} />
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

export default EmbeddingModelPage;
