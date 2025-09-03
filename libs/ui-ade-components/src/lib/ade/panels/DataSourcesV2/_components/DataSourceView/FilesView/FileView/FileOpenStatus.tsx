import type { AgentState, FileMetadata } from '@letta-cloud/sdk-core';
import { UseAgentsServiceRetrieveAgentKeyFn } from '@letta-cloud/sdk-core';
import {
  useAgentsServiceCloseFile,
  useAgentsServiceOpenFile,
} from '@letta-cloud/sdk-core';
import { isAgentState } from '@letta-cloud/sdk-core';
import { useTranslations } from '@letta-cloud/translations';
import { useMemo } from 'react';
import {
  Button,
  EyeClosedIcon,
  EyeOpenIcon,
  toast,
} from '@letta-cloud/ui-component-library';
import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentSimulatedAgent } from '../../../../../../../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import {
  useCurrentAgent,
  useCurrentAgentMetaData,
} from '../../../../../../../hooks';

interface OpenFileSlotProps {
  agentId: string;
  file: FileMetadata;
}

function FileIsClosedButton(props: OpenFileSlotProps) {
  const { agentId, file } = props;

  const currentAgentQueryKey = UseAgentsServiceRetrieveAgentKeyFn({
    agentId,
  });

  const queryClient = useQueryClient();

  const { mutate, isPending } = useAgentsServiceOpenFile({
    onMutate: () => {
      const previousAgentState = queryClient.getQueryData(currentAgentQueryKey);

      queryClient.setQueryData(
        currentAgentQueryKey,
        (old: AgentState | undefined) => {
          if (!old) {
            return old;
          }

          return {
            ...old,
            memory: {
              ...old.memory,
              file_blocks: old.memory.file_blocks?.map((f) => {
                if (f.file_id === file.id) {
                  return {
                    ...f,
                    is_open: true,
                  };
                }
                return f;
              }),
            },
          };
        },
      );

      return { previousAgentState };
    },
    onError: (_e, _v, context) => {
      toast.error(t('failedToOpen'));

      if (!context) {
        return;
      }
      queryClient.setQueryData(
        currentAgentQueryKey,
        context.previousAgentState,
      );
    },
  });

  const t = useTranslations('ADE/DataSources/FileOpenStatus');

  const { isTemplate } = useCurrentAgentMetaData();

  return (
    <Button
      busy={isPending}
      onClick={() => {
        mutate({
          agentId,
          fileId: file.id || '',
        });
      }}
      size="xsmall"
      hideLabel
      color="tertiary"
      label={t('closed', {
        agentType: isTemplate ? t('simulated') : '',
      })}
      preIcon={<EyeClosedIcon size="xsmall" />}
    ></Button>
  );
}

function FileIsOpenButton(props: OpenFileSlotProps) {
  const { agentId, file } = props;

  const currentAgentQueryKey = UseAgentsServiceRetrieveAgentKeyFn({
    agentId,
  });

  const queryClient = useQueryClient();
  const t = useTranslations('ADE/DataSources/FileOpenStatus');

  const { mutate, isPending } = useAgentsServiceCloseFile({
    onMutate: () => {
      const previousAgentState = queryClient.getQueryData(currentAgentQueryKey);

      queryClient.setQueryData(
        currentAgentQueryKey,
        (old: AgentState | undefined) => {
          if (!old) {
            return old;
          }

          return {
            ...old,
            memory: {
              ...old.memory,
              file_blocks: old.memory.file_blocks?.map((f) => {
                if (f.file_id === file.id) {
                  return {
                    ...f,
                    is_open: false,
                  };
                }
                return f;
              }),
            },
          };
        },
      );

      return { previousAgentState };
    },
    onError: (_e, _v, context) => {
      toast.error(t('failedToClose'));

      if (!context) {
        return;
      }
      queryClient.setQueryData(
        currentAgentQueryKey,
        context.previousAgentState,
      );
    },
  });

  const { isTemplate } = useCurrentAgentMetaData();

  return (
    <Button
      busy={isPending}
      onClick={() => {
        mutate({
          agentId,
          fileId: file.id || '',
        });
      }}
      size="xsmall"
      hideLabel
      color="tertiary"
      label={t('open', {
        agentType: isTemplate ? t('simulated') : '',
      })}
      preIcon={<EyeOpenIcon size="xsmall" />}
    />
  );
}

interface FileOpenStatusInnerProps {
  file: FileMetadata;
  agent: AgentState;
}

function FileOpenStatusInner(props: FileOpenStatusInnerProps) {
  const { file, agent } = props;

  const isFileOpen = useMemo(() => {
    if (!agent.memory.file_blocks) {
      return false;
    }

    return agent.memory.file_blocks.some((f) => {
      return f.file_id === file.id && f.is_open;
    });
  }, [agent.memory.file_blocks, file.id]);

  if (isFileOpen) {
    return <FileIsOpenButton agentId={agent.id} file={file} />;
  }

  return <FileIsClosedButton agentId={agent.id} file={file} />;
}

interface FileOpenStatusProps {
  file: FileMetadata;
}

export function FileOpenStatus(props: FileOpenStatusProps) {
  const { simulatedAgent } = useCurrentSimulatedAgent();
  const baseAgent = useCurrentAgent();
  const { isTemplate } = useCurrentAgentMetaData();

  const agent = useMemo(() => {
    if (isTemplate) {
      return simulatedAgent;
    }
    return baseAgent;
  }, [baseAgent, isTemplate, simulatedAgent]);

  const { file } = props;

  if (!isAgentState(agent)) {
    return null;
  }

  return <FileOpenStatusInner file={file} agent={agent} />;
}
