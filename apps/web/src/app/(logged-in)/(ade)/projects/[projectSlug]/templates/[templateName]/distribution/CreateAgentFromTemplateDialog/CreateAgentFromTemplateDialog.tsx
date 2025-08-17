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
import { useCurrentTemplateSnapshot } from '$web/client/hooks/useCurrentTemplateSnapshot/useCurrentTemplateSnapshot';
import type { TemplateSnapshotSchemaType } from '@letta-cloud/utils-shared';
import React, { type FormEvent, useCallback, useMemo } from 'react';
import { UseAgentsServiceListAgentsKeyFn } from '@letta-cloud/sdk-core';
import { cloudAPI } from '@letta-cloud/sdk-cloud-api';
import { useRouter } from 'next/navigation';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useQueryClient } from '@tanstack/react-query';
import { isFetchError } from '@ts-rest/react-query/v5';
import { BillingLink } from '@letta-cloud/ui-component-library';

interface CreateAgentFromTemplateDialogProps {
  templateName: string;
  trigger: React.ReactNode;
}

interface AgentInputDetailsProps {
  template: TemplateSnapshotSchemaType;
  templateName: string;
}

function AgentInputDetails(props: AgentInputDetailsProps) {
  const { template, templateName } = props;
  const version = template.version;

  const agentTemplate = useMemo(() => {
    return template.agents[0];
  }, [template]);

  const { push } = useRouter();
  const { slug: projectSlug } = useCurrentProject();

  const t = useTranslations('pages/distribution/CreateAgentFromTemplateDialog');

  const toolVariablesInTemplate = useMemo(() => {
    return (agentTemplate?.toolVariables?.data || [])?.map((item) => item.key);
  }, [agentTemplate]);

  const memoryVariablesInTemplate = useMemo(() => {
    return (agentTemplate?.memoryVariables?.data || [])?.map(
      (item) => item.key,
    );
  }, [agentTemplate]);

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
    error,
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

  const errorMessage = useMemo(() => {
    if (error) {
      if (!isFetchError(error) && error.status === 402) {
        return t.rich('errors.limit', {
          limit: () => error.body.limit,
          link: (chunks) => <BillingLink>{chunks}</BillingLink>,
        });
      }

      return t('errors.default');
    }

    return null;
  }, [error, t]);

  if (template.type !== 'classic') {
    return <Typography>{t('errors.unsupportedTemplateType')}</Typography>;
  }

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
        <FormActions errorMessage={errorMessage} align="end">
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
  const { data: latestTemplate } = useCurrentTemplateSnapshot('latest');

  const t = useTranslations('pages/distribution/CreateAgentFromTemplateDialog');

  return (
    <Dialog
      disableForm
      hideFooter
      title={t('title', { templateName })}
      trigger={trigger}
    >
      {!latestTemplate ? (
        <LoadingEmptyStatusComponent isLoading loadingMessage={t('loading')} />
      ) : (
        <VStack>
          <Typography>{t('description', { templateName })}</Typography>
          <AgentInputDetails
            templateName={templateName}
            template={latestTemplate.body}
          />
        </VStack>
      )}
    </Dialog>
  );
}
