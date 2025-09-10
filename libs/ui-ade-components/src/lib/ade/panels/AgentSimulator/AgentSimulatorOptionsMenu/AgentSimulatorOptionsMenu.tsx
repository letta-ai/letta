import { useTranslations } from '@letta-cloud/translations';
import { useADEState } from '../../../../hooks/useADEState/useADEState';
import {
  Button,
  Checkbox,
  Dialog,
  DotsHorizontalIcon,
  DropdownMenu,
  DropdownMenuItem,
  FormField,
  FormProvider, HotKey,
  HStack,
  toast,
  Typography,
  useForm
} from '@letta-cloud/ui-component-library';
import { ShareAgentDialog } from '../ShareAgentDialog/ShareAgentDialog';
import React, { useCallback, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentSimulatedAgent } from '../../../../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import {
  UseAgentsServiceListMessagesKeyFn,
  useAgentsServiceResetMessages,
} from '@letta-cloud/sdk-core';
import { useAtom } from 'jotai/index';
import { adeKeyMap, chatroomRenderModeAtom } from '@letta-cloud/ui-ade-components';
import { useHotkeys } from '@mantine/hooks';

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
  const t = useTranslations('ADE/AgentSimulator.AgentSimulatorOptionsMenu');
  const { isLocal, isTemplate } = useADEState();

  const [renderMode, setRenderMode] = useAtom(chatroomRenderModeAtom)

  useHotkeys([
    [
      adeKeyMap.ENABLE_DEBUG_MODE.command,
      () => {
        setRenderMode(mode => {
          if (mode === 'debug') {
            return 'interactive';
          }

          return 'debug';
        });
      },
    ],
    [
      adeKeyMap.HIDE_REASONING.command,
      () => {
        setRenderMode(mode => {
          if (mode === 'simple') {
            return 'interactive';
          }

          return 'simple';
        });
      },
    ],
  ]);


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
            label={t('trigger')}
          />
        }
      >
        <AgentResetMessagesDialog />
        <DropdownMenuItem
          label={renderMode === 'debug' ? t('options.debugMode.disable') : t('options.debugMode.enable')}
          endBadge={<HotKey command={adeKeyMap.ENABLE_DEBUG_MODE.command} />}
          onClick={() => {
            setRenderMode('debug');
          }}
        />
        {renderMode !== 'debug' && (
          <DropdownMenuItem
            label={renderMode === 'simple' ? t('options.reasoning.show') : t('options.reasoning.hide')}
            endBadge={<HotKey command={adeKeyMap.HIDE_REASONING.command} />}
            onClick={() => {
              setRenderMode('simple');
            }}
          />
        )}

        {!isLocal && !isTemplate && <ShareAgentDialog />}
      </DropdownMenu>
  );
}
