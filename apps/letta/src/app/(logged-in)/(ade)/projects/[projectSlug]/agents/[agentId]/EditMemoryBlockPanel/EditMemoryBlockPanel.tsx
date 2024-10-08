import { z } from 'zod';
import type { PanelTemplate } from '@letta-web/component-library';
import { RawTextArea } from '@letta-web/component-library';
import {
  LettaLoaderPanel,
  PanelMainContent,
  RawInput,
} from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import type { Block } from '@letta-web/letta-agents-api';
import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../hooks';
import type { ChangeEvent } from 'react';
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

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      syncUpdateCurrentAgent((prev) => ({
        memory: {
          ...prev.memory,
          memory: {
            ...prev.memory?.memory,
            [block.label || '']: {
              ...prev.memory?.memory?.[block.label || ''],
              value: e.target.value,
            },
          },
        },
      }));
    },
    [block.label, syncUpdateCurrentAgent]
  );

  return (
    <PanelMainContent>
      <RawInput disabled fullWidth label="Name" value={block.name || ''} />
      <RawInput disabled fullWidth label="Label" value={block.label || ''} />
      <RawTextArea
        data-testid="edit-memory-block-content"
        fullWidth
        label="Content"
        onChange={handleChange}
        value={value || ''}
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
