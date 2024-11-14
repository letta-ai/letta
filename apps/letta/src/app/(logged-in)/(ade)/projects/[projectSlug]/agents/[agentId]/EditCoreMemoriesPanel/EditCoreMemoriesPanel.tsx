import { z } from 'zod';
import type { PanelTemplate } from '@letta-web/component-library';
import { DialogContentWithCategories } from '@letta-web/component-library';

import { Dialog } from '@letta-web/component-library';
import { HStack, RawTextArea, Typography } from '@letta-web/component-library';
import { VStack } from '@letta-web/component-library';
import { PanelMainContent } from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import { useCurrentAgent } from '../hooks';
import { useState } from 'react';
import React, { useMemo } from 'react';
import { useDateFormatter } from '@letta-web/helpful-client-utils';
import { useUpdateMemory } from '../hooks/useUpdateMemory/useUpdateMemory';

interface AdvancedEditMemoryProps {
  defaultLabel: string;
  onClose: () => void;
}

function AdvancedEditMemory(props: AdvancedEditMemoryProps) {
  const { defaultLabel, onClose } = props;
  const agent = useCurrentAgent();
  const t = useTranslations('ADE/EditCoreMemoriesPanel');

  const memories = useMemo(() => {
    return Object.values(agent.memory?.memory || {});
  }, [agent.memory?.memory]);

  return (
    <Dialog
      isOpen
      noContentPadding
      preventCloseFromOutside
      size="full"
      hideConfirm
      title={t('AdvancedEditMemory.title')}
      onOpenChange={(state) => {
        if (!state) {
          onClose();
        }
      }}
    >
      <DialogContentWithCategories
        defaultCategory={defaultLabel}
        categories={memories.map((block) => ({
          id: block.label || '',
          title: block.label || '',
          children: <EditMemoryForm label={block.label || ''} isModelView />,
        }))}
      />
    </Dialog>
  );
}

interface AdvancedEditorPayload {
  label: string;
}

interface EditMemoryFormProps extends AdvancedEditorPayload {
  isModelView?: boolean;
}

function EditMemoryForm(props: EditMemoryFormProps) {
  const { label, isModelView } = props;

  const { formatDate } = useDateFormatter();

  const t = useTranslations('ADE/EditCoreMemoriesPanel');

  const [isAdvancedEditOpen, setIsAdvancedEditOpen] = useState(false);

  const { value, onChange, error, lastUpdatedAt, isUpdating } = useUpdateMemory(
    {
      label,
      type: 'memory',
    }
  );

  return (
    <>
      {isAdvancedEditOpen && (
        <AdvancedEditMemory
          onClose={() => {
            setIsAdvancedEditOpen(false);
          }}
          defaultLabel={label}
        />
      )}
      <VStack
        borderBottom={isModelView}
        fullHeight={isModelView}
        paddingX="small"
        paddingTop="small"
      >
        <VStack fullWidth fullHeight={isModelView}>
          <HStack fullWidth justify="spaceBetween">
            <Typography variant="body2">{label}</Typography>
            <Typography variant="body2" color="muted">
              {t('EditMemoryForm.characterLimit', {
                count: value.length,
                limit: 4000,
              })}
            </Typography>
          </HStack>
          <RawTextArea
            hideLabel
            autosize={false}
            flex={isModelView}
            fullHeight={isModelView}
            data-testid="edit-memory-block-content"
            fullWidth
            label={t('content')}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            expandable={
              !isModelView
                ? {
                    expandText: t('expandContent'),
                    onExpand: () => {
                      setIsAdvancedEditOpen(true);
                    },
                  }
                : undefined
            }
            value={value}
          />
        </VStack>
        <HStack align="center" justify="spaceBetween">
          <HStack
            paddingBottom={isModelView ? 'small' : undefined}
            justify="start"
          >
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
                    date: formatDate(lastUpdatedAt),
                  })}
              </Typography>
            )}
          </HStack>
        </HStack>
      </VStack>
    </>
  );
}

function EditMemory() {
  const agent = useCurrentAgent();

  const memories = useMemo(() => {
    return Object.values(agent.memory?.memory || {});
  }, [agent.memory?.memory]);

  return (
    <PanelMainContent>
      <VStack gap="small">
        {memories.map((block) => (
          <EditMemoryForm label={block.label || ''} key={block.label || ''} />
        ))}
      </VStack>
    </PanelMainContent>
  );
}

export const editCoreMemories = {
  templateId: 'edit-core-memories',
  content: EditMemory,
  useGetTitle: () => {
    const t = useTranslations('ADE/EditCoreMemoriesPanel');
    const { memory } = useCurrentAgent();

    const memoryCount = Object.keys(memory?.memory || {}).length;

    return t('title', { count: memoryCount || '-' });
  },
  data: z.undefined(),
} satisfies PanelTemplate<'edit-core-memories'>;
