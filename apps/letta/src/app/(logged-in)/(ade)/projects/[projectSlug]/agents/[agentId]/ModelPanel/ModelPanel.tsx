import React, { useCallback, useMemo } from 'react';
import {
  FormProvider,
  FormField,
  Select,
  useForm,
  Form,
  Button,
  HStack,
  PanelMainContent,
  type PanelTemplate,
  Typography,
  Alert,
  brandKeyToName,
  isBrandKey,
  brandKeyToLogo,
} from '@letta-web/component-library';
import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../hooks';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useModelsServiceListModels } from '@letta-web/letta-agents-api';
import { useTranslations } from 'next-intl';
import { nicelyFormattedDateAndTime } from '@letta-web/helpful-client-utils';

const modelSelectorSchema = z.object({
  model: z.object({
    icon: z.any(),
    label: z.string(),
    value: z.string(),
  }),
});

export function ModelPanel() {
  const currentAgent = useCurrentAgent();
  const t = useTranslations('ADE/ModelPanel');
  const { syncUpdateCurrentAgent, isUpdating, lastUpdatedAt, error } =
    useSyncUpdateCurrentAgent();

  const { data: modelsList } = useModelsServiceListModels();

  const formattedModelsList = useMemo(() => {
    if (!modelsList) {
      return [];
    }

    const modelEndpointMap = modelsList.reduce((acc, model) => {
      acc[model.model_endpoint_type] = acc[model.model_endpoint_type] || [];

      acc[model.model_endpoint_type].push(model.model);

      return acc;
    }, {} as Record<string, string[]>);

    return Object.entries(modelEndpointMap).map(([key, value]) => ({
      icon: isBrandKey(key) ? brandKeyToLogo(key) : '',
      label: isBrandKey(key) ? brandKeyToName(key) : key,
      options: value.map((model) => ({
        icon: isBrandKey(key) ? brandKeyToLogo(key) : '',
        label: model,
        value: model,
      })),
    }));
  }, [modelsList]);

  const form = useForm<z.infer<typeof modelSelectorSchema>>({
    resolver: zodResolver(modelSelectorSchema),
    defaultValues: {
      model: {
        icon: isBrandKey(currentAgent.llm_config.model_endpoint_type)
          ? brandKeyToLogo(currentAgent.llm_config.model_endpoint_type)
          : '',
        label: currentAgent.llm_config.model,
        value: currentAgent.llm_config.model,
      },
    },
  });

  const onSubmit = useCallback(
    (values: z.infer<typeof modelSelectorSchema>) => {
      if (!modelsList) {
        return;
      }

      const llmConfig = modelsList.find(
        (model) => model.model === values.model.value
      );

      syncUpdateCurrentAgent(() => ({
        llm_config: llmConfig,
      }));
    },
    [modelsList, syncUpdateCurrentAgent]
  );

  return (
    <PanelMainContent>
      {error && <Alert title={t('error')} variant="destructive" />}
      <FormProvider {...form}>
        <Form onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="model"
            render={({ field }) => (
              <Select
                fullWidth
                onSelect={(value) => {
                  field.onChange(value);
                }}
                value={field.value}
                label={t('modelInput.label')}
                options={formattedModelsList}
              />
            )}
          />
          <HStack align="center" justify="spaceBetween">
            <Typography color="muted">
              {lastUpdatedAt &&
                t('lastUpdatedAt', {
                  date: nicelyFormattedDateAndTime(lastUpdatedAt),
                })}
            </Typography>
            <Button
              type="submit"
              color="primary"
              label={t('updateModel')}
              busy={isUpdating}
            />
          </HStack>
        </Form>
      </FormProvider>
    </PanelMainContent>
  );
}

export const modelTemplate = {
  templateId: 'model-details',
  content: ModelPanel,
  useGetTitle: () => 'Model',
  data: z.undefined(),
} satisfies PanelTemplate<'model-details'>;
