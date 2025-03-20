import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  Dialog,
  FormActions,
  type KeyValue,
  LettaInvaderIcon,
  LoadingEmptyStatusComponent,
  RawKeyValueEditor,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useLatestAgentTemplate } from '$web/client/hooks/useLatestAgentTemplate/useLatestAgentTemplate';
import { findMemoryBlockVariables } from '@letta-cloud/utils-shared';
import React, { type FormEvent, useCallback, useMemo } from 'react';
import {
  type AgentState,
  UseAgentsServiceListAgentsKeyFn,
} from '@letta-cloud/sdk-core';
import { cloudAPI } from '@letta-cloud/sdk-cloud-api';
import { useRouter } from 'next/navigation';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useQueryClient } from '@tanstack/react-query';

interface CreateAgentFromTemplateDialogProps {
  templateName: string;
  trigger: React.ReactNode;
}

interface AgentInputDetailsProps {
  agentState: AgentState;
  version: string;
  templateName: string;
}

function AgentInputDetails(props: AgentInputDetailsProps) {
  const { agentState, templateName, version } = props;

  const { push } = useRouter();
  const { slug: projectSlug } = useCurrentProject();

  const t = useTranslations('pages/distribution/CreateAgentFromTemplateDialog');

  const toolVariablesInTemplate = useMemo(() => {
    return (agentState.tool_exec_environment_variables || [])?.map(
      (item) => item.key,
    );
  }, [agentState]);

  const memoryVariablesInTemplate = useMemo(() => {
    return findMemoryBlockVariables(agentState);
  }, [agentState]);

  const [memoryVariables, setMemoryVariables] = React.useState<KeyValue[]>(
    memoryVariablesInTemplate
      ? memoryVariablesInTemplate.map((item) => ({ key: item, value: '' }))
      : [],
  );

  const [toolVariables, setToolVariables] = React.useState<KeyValue[]>(
    toolVariablesInTemplate
      ? toolVariablesInTemplate.map((item) => ({ key: item, value: '' }))
      : [],
  );

  const queryClient = useQueryClient();

  const {
    mutate: createAgent,
    isSuccess,
    isError,
    isPending,
  } = cloudAPI.templates.createAgentsFromTemplate.useMutation({
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: ['infinite', ...UseAgentsServiceListAgentsKeyFn()],
        exact: false,
      });

      push(`/projects/${projectSlug}/agents/${data.body.agents[0].id}`);
    },
  });

  const handleCreateAgent = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (isSuccess || isPending) {
        return;
      }

      createAgent({
        params: {
          project: projectSlug,
          template_version: `${templateName}:${version}`,
        },
        body: {
          memory_variables: Object.fromEntries(
            memoryVariables.map(({ key, value }) => [key, value]),
          ),
          tool_variables: Object.fromEntries(
            toolVariables.map(({ key, value }) => [key, value]),
          ),
        },
      });
    },
    [
      createAgent,
      isPending,
      templateName,
      isSuccess,
      projectSlug,
      toolVariables,
      version,
      memoryVariables,
    ],
  );

  return (
    <form className="contents" onSubmit={handleCreateAgent}>
      <VStack fullHeight paddingBottom gap="form" flex>
        {memoryVariablesInTemplate.length > 0 ||
        toolVariablesInTemplate.length > 0 ? (
          <Typography>{t('inputDetails')}</Typography>
        ) : null}
        {memoryVariablesInTemplate.length > 0 && (
          <RawKeyValueEditor
            freezeRows
            fullWidth
            disableKey
            label={t('memoryVariables')}
            value={memoryVariables}
            onValueChange={setMemoryVariables}
          />
        )}
        {toolVariablesInTemplate.length > 0 && (
          <RawKeyValueEditor
            freezeRows
            disableKey
            fullWidth
            label={t('toolVariables')}
            value={toolVariables}
            onValueChange={setToolVariables}
          />
        )}
        <FormActions
          errorMessage={isError ? t('error') : undefined}
          align="end"
        >
          <Button
            type="submit"
            busy={isPending || isSuccess}
            data-testid="complete-create-agent-button"
            label={t('create')}
            preIcon={<LettaInvaderIcon />}
            color="primary"
          />
        </FormActions>
      </VStack>
    </form>
  );
}

export function CreateAgentFromTemplateDialog(
  props: CreateAgentFromTemplateDialogProps,
) {
  const { trigger, templateName } = props;
  const { deployedAgentTemplate } = useLatestAgentTemplate();

  const t = useTranslations('pages/distribution/CreateAgentFromTemplateDialog');

  return (
    <Dialog
      disableForm
      hideFooter
      title={t('title', { templateName })}
      trigger={trigger}
    >
      {!deployedAgentTemplate?.state ? (
        <LoadingEmptyStatusComponent isLoading loadingMessage={t('loading')} />
      ) : (
        <VStack>
          <Typography>{t('description', { templateName })}</Typography>
          <AgentInputDetails
            templateName={templateName}
            version={deployedAgentTemplate.version}
            agentState={deployedAgentTemplate.state}
          />
        </VStack>
      )}
    </Dialog>
  );
}
