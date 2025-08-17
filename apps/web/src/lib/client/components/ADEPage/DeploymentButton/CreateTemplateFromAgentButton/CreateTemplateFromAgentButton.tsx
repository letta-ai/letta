import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useCurrentAgent } from '$web/client/hooks/useCurrentAgent/useCurrentAgent';
import { atom, useSetAtom } from 'jotai/index';
import { cloudAPI } from '@letta-cloud/sdk-cloud-api';
import {
  Button,
  Popover,
  TemplateIcon,
  toast,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BlocksService } from '@letta-cloud/sdk-core';
export const isAgentConvertingToTemplateAtom = atom(false);

export function CreateTemplateButton() {
  const { slug } = useCurrentProject();
  const { id: agentId } = useCurrentAgent();
  const setConvertingAtom = useSetAtom(isAgentConvertingToTemplateAtom);

  const { memory } = useCurrentAgent();
  const { data: hasSharedMemoryBlocks } = useQuery({
    queryKey: ['has-connected-blocks', agentId],
    queryFn: async () => {
      if (!memory?.blocks) {
        return false;
      }

      const memoryBlockSiblings = await Promise.all(
        memory.blocks.map(async (block) => {
          const agentList = await BlocksService.listAgentsForBlock({
            blockId: block.id || '',
          });

          return agentList.length > 1;
        }),
      );

      return memoryBlockSiblings.some((hasShared) => hasShared === true);
    },
    enabled: !!agentId && !!memory?.blocks?.length,
  });

  const { mutate, isPending, isSuccess } =
    cloudAPI.templates.createTemplate.useMutation({
      onSuccess: (body) => {
        const { name } = body.body;

        // do not use next/link here as we need to force a full page reload
        window.location.href = `/projects/${slug}/templates/${name}`;
      },
      onError: () => {
        setConvertingAtom(false);
        toast.error(t('CreateTemplateButton.error'));
      },
    });

  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );

  const handleConvert = useCallback(() => {
    setConvertingAtom(true);

    mutate({
      params: {
        project: slug,
      },
      body: {
        type: 'agent',
        agent_id: agentId,
      },
    });
  }, [setConvertingAtom, mutate, agentId, slug]);

  if (
    typeof hasSharedMemoryBlocks !== 'boolean' ||
    hasSharedMemoryBlocks === true
  ) {
    return null;
  }

  return (
    <Popover
      align="end"
      triggerAsChild
      trigger={
        <Button
          size="default"
          preIcon={<TemplateIcon />}
          color="primary"
          label={t('CreateTemplateButton.trigger')}
        />
      }
    >
      <VStack padding="medium" gap="large">
        <VStack>
          <Typography bold>{t('CreateTemplateButton.title')}</Typography>
          <Typography>{t('CreateTemplateButton.description')}</Typography>
        </VStack>
        <Button
          color="primary"
          busy={isPending || isSuccess}
          fullWidth
          label={t('CreateTemplateButton.cta')}
          type="button"
          onClick={handleConvert}
        />
      </VStack>
    </Popover>
  );
}
