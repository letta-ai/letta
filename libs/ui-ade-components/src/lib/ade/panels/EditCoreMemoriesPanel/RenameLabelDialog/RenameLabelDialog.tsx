import React, { useCallback, useState, useMemo } from 'react';
import {
  Button,
  Dialog,
  FormField,
  FormProvider,
  Input,
  EditIcon,
  useForm,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useUpdateMemoryBlockName } from '../../../../hooks/useUpdateMemoryBlockName/useUpdateMemoryBlockName';
import { useCurrentAgentMetaData } from '../../../../hooks';
import { useADEPermissions } from '../../../../hooks/useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSetAtom } from 'jotai';
import { currentAdvancedCoreMemoryAtom } from '../currentAdvancedCoreMemoryAtom';

interface RenameLabelDialogProps {
  blockId: string;
  currentLabel: string;
  onSuccess?: () => void;
}

export function RenameLabelDialog(props: RenameLabelDialogProps) {
  const { blockId, currentLabel, onSuccess } = props;
  const t = useTranslations('components/RenameLabelDialog');
  const { isTemplate, agentId, templateId } = useCurrentAgentMetaData();
  const setCurrentAdvancedCoreMemoryAtom = useSetAtom(currentAdvancedCoreMemoryAtom);

  const [isOpen, setIsOpen] = useState(false);

  const renameLabelSchema = useMemo(() => {
    return z.object({
      label: z.string().refine((value) => {
        // For new/changed labels, apply the strict validation
        return /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(value);
      }, t('form.label.error')),
    });
  }, [t]);

  type RenameLabelPayload = z.infer<typeof renameLabelSchema>;

  const { handleUpdate, isPending, isError } = useUpdateMemoryBlockName({
    memoryType: isTemplate ? 'templated' : 'agent',
    currentLabel,
    agentId,
    blockId,
    templateId,
    onSuccess: () => {
      setIsOpen(false);
      onSuccess?.();
    },
  });

  const form = useForm<RenameLabelPayload>({
    resolver: zodResolver(renameLabelSchema),
    defaultValues: {
      label: currentLabel,
    },
  });

  const handleRenameSubmit = useCallback(
    async (values: RenameLabelPayload) => {
      trackClientSideEvent(AnalyticsEvent.UPDATE_BLOCK_IN_CORE_MEMORY, {
        agent_id: agentId,
      });

      const result = await handleUpdate({
        label: values.label,
      });

      if (!result.success && result.error) {
        // Set form error if the update failed
        form.setError('label', {
          message: result.error,
        });
      } else if (result.success) {
        // Update the selected memory block label in the atom
        setCurrentAdvancedCoreMemoryAtom((prev) => ({
          ...prev,
          selectedMemoryBlockLabel: values.label,
        }));
      }
    },
    [handleUpdate, agentId, form, setCurrentAdvancedCoreMemoryAtom],
  );

  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  if (!canUpdateAgent) {
    return null;
  }

  return (
    <FormProvider {...form}>
      <Dialog
        testId="rename-label-dialog"
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        title={t('title')}
        trigger={
          <Button
            hideLabel
            data-testid="rename-memory-block-label"
            preIcon={<EditIcon />}
            color="tertiary"
            label={t('trigger')}
          />
        }
        errorMessage={isError ? t('error') : undefined}
        isConfirmBusy={isPending}
        confirmText={t('form.rename')}
        onSubmit={form.handleSubmit(handleRenameSubmit)}
      >
        <FormField
          name="label"
          render={({ field }) => (
            <Input
              fullWidth
              data-testid="rename-label-input"
              label={t('form.label.label')}
              placeholder={t('form.label.placeholder')}
              {...field}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}
