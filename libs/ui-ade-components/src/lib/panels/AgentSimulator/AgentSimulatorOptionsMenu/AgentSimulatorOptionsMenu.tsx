import { useTranslations } from '@letta-cloud/translations';
import { useADEState } from '../../../hooks/useADEState/useADEState';
import {
  Button,
  Checkbox,
  Dialog,
  DotsHorizontalIcon,
  DropdownMenu,
  DropdownMenuItem,
  FormField,
  FormProvider,
  HStack,
  toast,
  Typography,
  useForm,
} from '@letta-cloud/ui-component-library';
import { ShareAgentDialog } from '../ShareAgentDialog/ShareAgentDialog';
import React, { useCallback, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentSimulatedAgent } from '../../../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import {
  UseAgentsServiceListMessagesKeyFn,
  useAgentsServiceResetMessages,
} from '@letta-cloud/sdk-core';

const AgentResetMessagesSchema = z.object({
  addDefaultInitialMessages: z.boolean(),
});

type AgentResetMessagesPayload = z.infer<typeof AgentResetMessagesSchema>;

export function AgentResetMessagesDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations('ADE/AgentSimulator');

  const form = useForm<AgentResetMessagesPayload>({
    resolver: zodResolver(AgentResetMessagesSchema),
    defaultValues: {
      addDefaultInitialMessages: true,
    },
  });

  const queryClient = useQueryClient();

  const { id: agentId } = useCurrentSimulatedAgent();

  const {
    mutate: resetMessages,
    isPending,
    reset,
  } = useAgentsServiceResetMessages({
    onSuccess: async () => {
      await queryClient.resetQueries({
        queryKey: UseAgentsServiceListMessagesKeyFn({ agentId }),
      });
      toast.success(t('AgentResetMessagesDialog.success'));
      form.reset();
      reset();
      setIsOpen(false);
    },
    onError: () => {
      toast.error(t('AgentResetMessagesDialog.error'));
    },
  });

  const handleResetMessages = useCallback(
    (values: AgentResetMessagesPayload) => {
      resetMessages({
        agentId,
        addDefaultInitialMessages: values.addDefaultInitialMessages,
      });
    },
    [agentId, resetMessages],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        isConfirmBusy={isPending}
        isOpen={isOpen}
        trigger={
          <DropdownMenuItem
            doNotCloseOnSelect
            label={t('AgentResetMessagesDialog.trigger')}
          />
        }
        title={t('AgentResetMessagesDialog.title')}
        confirmText={t('AgentResetMessagesDialog.confirm')}
        onSubmit={form.handleSubmit(handleResetMessages)}
        onOpenChange={setIsOpen}
      >
        <Typography>{t('AgentResetMessagesDialog.description')}</Typography>
        <HStack padding="small" paddingBottom="xxsmall" border fullWidth>
          <FormField
            name="addDefaultInitialMessages"
            render={({ field }) => (
              <Checkbox
                label={t('AgentResetMessagesDialog.addDefaultInitialMessages')}
                onCheckedChange={field.onChange}
                checked={field.value}
              />
            )}
          />
        </HStack>
      </Dialog>
    </FormProvider>
  );
}

export function AgentSimulatorOptionsMenu() {
  const t = useTranslations('ADE/AgentSimulator');
  const { isLocal, isTemplate } = useADEState();

  return (
      <DropdownMenu
        triggerAsChild
        align="end"
        trigger={
          <Button
            size="xsmall"
            color="tertiary"
            preIcon={<DotsHorizontalIcon />}
            hideLabel
            label={t('AgentSimulatorOptionsMenu.trigger')}
          />
        }
      >
        <AgentResetMessagesDialog />
        {!isLocal && !isTemplate && <ShareAgentDialog />}
      </DropdownMenu>
  );
}
