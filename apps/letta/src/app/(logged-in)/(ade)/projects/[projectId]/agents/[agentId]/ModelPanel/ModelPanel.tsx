import React, { useCallback, useMemo } from 'react';
import { ADENavigationItem } from '../common/ADENavigationItem/ADENavigationItem';
import {
  FormProvider,
  FormField,
  Panel,
  Select,
  useForm,
  Form,
  Button,
  HStack,
  PanelMainContent,
} from '@letta-web/component-library';
import { useCurrentAgent } from '../hooks';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useAgentsServiceUpdateAgent,
  useModelsServiceListModels,
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
    useAgentsServiceUpdateAgent();
  const { data: modelsList } = useModelsServiceListModels();

  const formattedModelsList = useMemo(() => {
    if (!modelsList) {
      return [];
    }

    return modelsList.map((model) => ({
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

      const llmConfig = modelsList.find(
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
      id="model-panel"
      title="Current Model"
      trigger={
        <ADENavigationItem
          title="Model"
          preview={currentAgent.llm_config.model}
        />
      }
    >
      <PanelMainContent>
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
                  label="Model"
                  options={formattedModelsList}
                />
              )}
            />
            <HStack justify="spaceBetween">
              <div />
              <Button
                type="submit"
                size="small"
                color="secondary"
                label="Update"
                busy={isUpdateAgentModelPending}
              />
            </HStack>
          </Form>
        </FormProvider>
      </PanelMainContent>
    </Panel>
  );
}
