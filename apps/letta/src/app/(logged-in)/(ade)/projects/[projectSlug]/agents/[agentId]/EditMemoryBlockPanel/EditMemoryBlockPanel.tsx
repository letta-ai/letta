import { z } from 'zod';
import type { PanelTemplate } from '@letta-web/component-library';
import { PanelMainContent } from '@letta-web/component-library';
import { RawADEInput, RawADETextArea } from '@letta-web/component-library';
import { LettaLoaderPanel } from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import type { Block } from '@letta-web/letta-agents-api';
import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../hooks';
import type { ChangeEvent } from 'react';
import { useEffect, useState } from 'react';
import React, { useCallback, useMemo } from 'react';

interface EditMemoryFormProps {
  block: Block;
}

function EditMemoryForm({ block }: EditMemoryFormProps) {
  //https://linear.app/letta/issue/LET-136/infinite-loop-bug-saving-block

  const { memory } = useCurrentAgent();
  const { syncUpdateCurrentAgent } = useSyncUpdateCurrentAgent();

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
    <PanelMainContent>
      <RawADEInput disabled fullWidth label="Name" value={block.name || ''} />
      <RawADEInput disabled fullWidth label="Label" value={block.label || ''} />
      <RawADETextArea
        fullHeight
        data-testid="edit-memory-block-content"
        fullWidth
        label="Content"
        onChange={handleChange}
        value={localValue || ''}
      />
    </PanelMainContent>
  );
}

const EditMemoryData = z.object({
  blockId: z.string(),
  label: z.string(),
  name: z.string(),
});

type EditMemoryDataType = z.infer<typeof EditMemoryData>;

function EditMemory(props: EditMemoryDataType) {
  const { label } = props;

  const agent = useCurrentAgent();

  const data = useMemo(() => {
    return agent?.memory?.memory?.[label];
  }, [agent.memory?.memory, label]);

  return <>{!data ? <LettaLoaderPanel /> : <EditMemoryForm block={data} />}</>;
}

export const editMemoryBlocksTemplate = {
  templateId: 'edit-memory-block',
  content: EditMemory,
  useGetTitle: (data) => {
    const t = useTranslations('ADE/EditMemoryBlockPanel');

    return t('title', { blockName: data?.name });
  },
  data: EditMemoryData,
} satisfies PanelTemplate<'edit-memory-block'>;
