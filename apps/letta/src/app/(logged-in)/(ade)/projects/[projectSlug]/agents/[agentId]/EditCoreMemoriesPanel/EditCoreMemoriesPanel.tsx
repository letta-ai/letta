import { z } from 'zod';
import type { PanelTemplate } from '@letta-web/component-library';
import {
  Accordion,
  Badge,
  HStack,
  RawTextArea,
  Typography,
} from '@letta-web/component-library';
import { VStack } from '@letta-web/component-library';
import { PanelMainContent } from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import type { Block } from '@letta-web/letta-agents-api';
import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../hooks';
import type { ChangeEvent } from 'react';
import { useEffect, useState } from 'react';
import React, { useCallback, useMemo } from 'react';
import { nicelyFormattedDateAndTime } from '@letta-web/helpful-client-utils';

interface EditMemoryFormProps {
  block: Block;
}

function EditMemoryForm({ block }: EditMemoryFormProps) {
  const { memory } = useCurrentAgent();
  const { syncUpdateCurrentAgent, error, lastUpdatedAt, isUpdating } =
    useSyncUpdateCurrentAgent();
  const t = useTranslations('ADE/EditCoreMemoriesPanel');

  const value = useMemo(() => {
    return memory?.memory?.[block.label || '']?.value;
  }, [memory?.memory, block.label]);

  const [localValue, setLocalValue] = useState(value);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;

      setLocalValue(value);

      syncUpdateCurrentAgent((prev) => ({
        memory: {
          ...prev.memory,
          memory: {
            ...prev.memory?.memory,
            [block.label || '']: {
              ...prev.memory?.memory?.[block.label || ''],
              value: value,
            },
          },
        },
      }));
    },
    [block.label, syncUpdateCurrentAgent]
  );

  useEffect(() => {
    if (value !== localValue) {
      setLocalValue(value);
    }
  }, [localValue, value]);

  return (
    <Accordion
      id={block.id || ''}
      trigger={
        <HStack paddingX="small" align="center">
          <Typography bold>{block.name}</Typography>
          <Badge content={block.label || ''} />
        </HStack>
      }
    >
      <VStack paddingX="small" paddingTop="small">
        <VStack>
          <RawTextArea
            hideLabel
            data-testid="edit-memory-block-content"
            fullWidth
            label={t('content')}
            onChange={handleChange}
            value={localValue || ''}
          />
        </VStack>
        <HStack>
          {error ? (
            <Typography variant="body2" color="destructive">
              {t('error')}
            </Typography>
          ) : (
            <Typography variant="body2" color="muted">
              {isUpdating && t('updating')}
              {!isUpdating &&
                lastUpdatedAt &&
                t('lastUpdated', {
                  date: nicelyFormattedDateAndTime(lastUpdatedAt),
                })}
            </Typography>
          )}
        </HStack>
      </VStack>
    </Accordion>
  );
}

function EditMemory() {
  const agent = useCurrentAgent();

  const memories = useMemo(() => {
    return Object.values(agent.memory?.memory || {});
  }, [agent.memory?.memory]);

  return (
    <PanelMainContent variant="noPadding">
      {memories.map((block) => (
        <EditMemoryForm key={block.label} block={block} />
      ))}
    </PanelMainContent>
  );
}

export const editCoreMemories = {
  templateId: 'edit-core-memories',
  content: EditMemory,
  useGetTitle: (data) => {
    const t = useTranslations('ADE/EditCoreMemoriesPanel');

    return t('title', { blockName: data?.name });
  },
  data: z.undefined(),
} satisfies PanelTemplate<'edit-core-memories'>;
