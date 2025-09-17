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
  FormProvider,
  HotKey,
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
import { useCurrentSimulatedAgent } from '../../../../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import {
  UseAgentsServiceListMessagesKeyFn,
  useAgentsServiceResetMessages,
} from '@letta-cloud/sdk-core';
import { useAtom } from 'jotai/index';
import {
  adeKeyMap,
  chatroomRenderModeAtom, showRunDebuggerAtom
} from '@letta-cloud/ui-ade-components';
import { useHotkeys } from '@mantine/hooks';

const RENDER_MODE = {
  SIMPLE: 'simple' as const,
  INTERACTIVE: 'interactive' as const,
  DEBUG: 'debug' as const,
};

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

  const [renderMode, setRenderMode] = useAtom(chatroomRenderModeAtom);
  const [showRunDebugger, setShowRunDebugger] = useAtom(showRunDebuggerAtom)

  useHotkeys([
    [
      adeKeyMap.ENABLE_DEBUG_MODE.command,
      () => {
        setRenderMode((mode) => {
          if (mode === RENDER_MODE.DEBUG) {
            return RENDER_MODE.INTERACTIVE;
          }

          return RENDER_MODE.DEBUG;
        });
      },
    ],
    [
      adeKeyMap.TOGGLE_RUN_DEBUGGER.command,
      () => {
        setShowRunDebugger((show) => !show)
      }
    ],
    [
      adeKeyMap.HIDE_REASONING.command,
      () => {
        setRenderMode((mode) => {
          if (mode === RENDER_MODE.SIMPLE) {
            return RENDER_MODE.INTERACTIVE;
          }

          return RENDER_MODE.SIMPLE;
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
        label={
          renderMode === RENDER_MODE.DEBUG
            ? t('options.debugMode.disable')
            : t('options.debugMode.enable')
        }
        endBadge={<HotKey command={adeKeyMap.ENABLE_DEBUG_MODE.command} />}
        onClick={() => {
          setRenderMode(
            renderMode === RENDER_MODE.DEBUG
              ? RENDER_MODE.INTERACTIVE
              : RENDER_MODE.DEBUG,
          );
        }}
      />
      <DropdownMenuItem
        label={
          showRunDebugger
            ? t('options.runDebugger.hide')
            : t('options.runDebugger.show')
        }
        endBadge={<HotKey command={adeKeyMap.TOGGLE_RUN_DEBUGGER.command} />}
        onClick={() => {
          setShowRunDebugger(!showRunDebugger)
        }}
      />
      {renderMode !== RENDER_MODE.DEBUG && (
        <DropdownMenuItem
          label={
            renderMode === RENDER_MODE.SIMPLE
              ? t('options.reasoning.show')
              : t('options.reasoning.hide')
          }
          endBadge={<HotKey command={adeKeyMap.HIDE_REASONING.command} />}
          onClick={() => {
            setRenderMode(
              renderMode === RENDER_MODE.SIMPLE
                ? RENDER_MODE.INTERACTIVE
                : RENDER_MODE.SIMPLE,
            );
          }}
        />
      )}

      {!isLocal && !isTemplate && <ShareAgentDialog />}
    </DropdownMenu>
  );
}
