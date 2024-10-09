import { z } from 'zod';
import type { PanelTemplate } from '@letta-web/component-library';
import { Alert, Button, HStack, PanelBar } from '@letta-web/component-library';
import { RawADEInput, VStack } from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import React, { useCallback, useMemo } from 'react';
import {
  type AgentsServiceGetAgentSourcesDefaultResponse,
  useAgentsServiceGetAgentSources,
  UseAgentsServiceGetAgentSourcesKeyFn,
  useSourcesServiceDetachAgentFromSource,
} from '@letta-web/letta-agents-api';
import { useCurrentAgent } from '../hooks';
import { useQueryClient } from '@tanstack/react-query';
import { usePanelManager } from '../panelRegistry';

const DataSchema = z.object({
  id: z.string(),
  name: z.string(),
});

type DataProps = z.infer<typeof DataSchema>;

function EditDataSourcesPanel({ id }: DataProps) {
  const { id: agentId } = useCurrentAgent();
  const { data: agentSources } = useAgentsServiceGetAgentSources({
    agentId,
  });

  const { closePanel } = usePanelManager();

  const t = useTranslations('ADE/EditDataSourcesPanel');

  const {
    mutate: detachDataSource,
    isPending: isDetaching,
    isError: errorDetaching,
  } = useSourcesServiceDetachAgentFromSource();
  const queryClient = useQueryClient();

  const currentSource = useMemo(() => {
    return agentSources?.find((source) => source.id === id);
  }, [agentSources, id]);

  const handleDetach = useCallback(() => {
    detachDataSource(
      {
        agentId,
        sourceId: id,
      },
      {
        onSuccess: () => {
          queryClient.setQueriesData<
            AgentsServiceGetAgentSourcesDefaultResponse | undefined
          >(
            {
              queryKey: UseAgentsServiceGetAgentSourcesKeyFn({
                agentId,
              }),
            },
            (prev) => {
              return prev?.filter((source) => source.id !== id);
            }
          );

          closePanel(`edit-data-source-${id}`);
        },
      }
    );
  }, [agentId, closePanel, detachDataSource, id, queryClient]);

  const errorMessage = useMemo(() => {
    if (errorDetaching) {
      return t('errorDetaching');
    }

    return '';
  }, [errorDetaching, t]);

  return (
    <VStack fullHeight gap={false}>
      {errorMessage && <Alert title={errorMessage} variant="destructive" />}
      <PanelBar
        actions={
          <HStack>
            <Button
              size="small"
              color="tertiary"
              target="_blank"
              label={t('edit')}
              href={`/data-sources/${id}`}
            />
            <Button
              size="small"
              color="destructive"
              busy={isDetaching}
              onClick={handleDetach}
              label={t('detach')}
            />
          </HStack>
        }
      ></PanelBar>
      <RawADEInput
        disabled
        fullWidth
        label={t('editName.label')}
        value={currentSource?.name || ''}
      />
    </VStack>
  );
}

export const editDataSourcesPanel = {
  useGetTitle: (data) => {
    const t = useTranslations('ADE/EditDataSourcesPanel');

    return t('title', { name: data.name || '' });
  },
  data: DataSchema,
  content: EditDataSourcesPanel,
  templateId: 'edit-data-source',
} satisfies PanelTemplate<'edit-data-source'>;
