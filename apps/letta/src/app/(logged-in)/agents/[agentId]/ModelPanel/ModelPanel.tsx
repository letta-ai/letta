import React, { useCallback, useMemo } from 'react';
import { NavigationItem } from '../common/ADENavigationItem/ADENavigationItem';
import {
  FormProvider,
  FormField,
  Panel,
  Select,
  useForm,
  Form,
  PanelItem,
  PanelHeader,
} from '@letta-web/component-library';
import { useCurrentAgent } from '../hooks';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useAgentsServiceUpdateAgentApiAgentsAgentIdPost,
  useModelsServiceListModelsApiModelsGet,
} from '@letta-web/letta-agents-api';

const modelSelectorSchema = z.object({
  model: z.object({
    label: z.string(),
    value: z.string(),
  }),
});

export function ModelPanel() {
  const currentAgent = useCurrentAgent();
  const { mutate, isPending: isUpdateAgentModelPending } =
    useAgentsServiceUpdateAgentApiAgentsAgentIdPost();
  const { data: modelsList } = useModelsServiceListModelsApiModelsGet();

  const formattedModelsList = useMemo(() => {
    if (!modelsList) {
      return [];
    }

    return modelsList.models.map((model) => ({
      label: model.model,
      value: model.model,
    }));
  }, [modelsList]);

  const form = useForm<z.infer<typeof modelSelectorSchema>>({
    resolver: zodResolver(modelSelectorSchema),
    defaultValues: {
      model: {
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

      const llmConfig = modelsList.models.find(
        (model) => model.model === values.model.value
      );

      mutate({
        agentId: currentAgent.id,
        requestBody: {
          id: currentAgent.id,
          llm_config: llmConfig,
        },
      });
    },
    [currentAgent.id, modelsList, mutate]
  );

  return (
    <Panel
      width="compact"
      id={['sidebar', 'model']}
      trigger={
        <NavigationItem title="Model" preview={currentAgent.llm_config.model} />
      }
    >
      <FormProvider {...form}>
        <Form onSubmit={form.handleSubmit(onSubmit)}>
          <PanelHeader
            title="Current Model"
            showSave
            isSaving={isUpdateAgentModelPending}
          />

          <PanelItem>
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
                  label="Model"
                  options={formattedModelsList}
                />
              )}
            />
          </PanelItem>
        </Form>
      </FormProvider>
    </Panel>
  );
}
