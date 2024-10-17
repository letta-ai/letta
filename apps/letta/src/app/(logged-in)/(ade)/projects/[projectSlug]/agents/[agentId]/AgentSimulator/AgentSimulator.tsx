'use client';
import {
  Alert,
  Button,
  ChatBubbleIcon,
  ChatInput,
  CodeIcon,
  HStack,
  LoadingEmptyStatusComponent,
  ProgressBar,
  RawToggleGroup,
  Table,
  TableBody,
  TableCell,
  TableCellInput,
  TableRow,
  Typography,
  VariableIcon,
  WarningIcon,
} from '@letta-web/component-library';
import type { PanelTemplate } from '@letta-web/component-library';
import { PanelBar } from '@letta-web/component-library';
import { VStack } from '@letta-web/component-library';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect } from 'react';
import { useMemo } from 'react';
import React, { useCallback, useRef, useState } from 'react';
import type {
  AgentMessage,
  AgentState,
  Source,
} from '@letta-web/letta-agents-api';
import { useAgentsServiceGetAgentSources } from '@letta-web/letta-agents-api';
import {
  AgentMessageSchema,
  UseAgentsServiceListAgentMessagesKeyFn,
} from '@letta-web/letta-agents-api';
import { useCurrentAgent } from '../hooks';
import { EventSource } from 'extended-eventsource';
import { useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/query-core';
import { get } from 'lodash-es';
import type { MessagesDisplayMode } from '$letta/client/components';
import { Messages } from '$letta/client/components';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useDebouncedCallback, useLocalStorage } from '@mantine/hooks';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useCurrentProject } from '../../../../../../(dashboard-like)/projects/[projectSlug]/hooks';
import { findMemoryBlockVariables } from '$letta/utils';
import type { GetAgentTemplateSimulatorSessionResponseBody } from '$letta/web-api/agent-templates/agentTemplatesContracts';
import { isEqual } from 'lodash-es';
import { useCurrentSimulatedAgent } from '../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import toast from 'react-hot-toast';
import { useCurrentAgentMetaData } from '../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';

function useSendMessage(agentId: string) {
  const [isPending, setIsPending] = useState(false);
  const abortController = useRef<AbortController>();
  const queryClient = useQueryClient();

  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  const sendMessage = useCallback(
    (message: string) => {
      setIsPending(true);

      queryClient.setQueriesData<InfiniteData<AgentMessage[]> | undefined>(
        {
          queryKey: UseAgentsServiceListAgentMessagesKeyFn({ agentId }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          const [firstPage, ...rest] = [...oldData.pages];

          const newMessage: AgentMessage = {
            message_type: 'user_message',
            message: JSON.stringify({
              type: 'user_message',
              message: message,
              time: new Date().toISOString(),
            }),
            date: new Date().toISOString(),
            id: `${new Date().getTime()}-user_message`,
          };

          return {
            pageParams: oldData.pageParams,
            pages: [[newMessage, ...firstPage], ...rest],
          };
        }
      );

      abortController.current = new AbortController();

      const eventsource = new EventSource(`/v1/agents/${agentId}/messages`, {
        withCredentials: true,
        method: 'POST',
        disableRetry: true,
        keepalive: false,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          stream_steps: true,
          stream_tokens: true,
          messages: [
            {
              role: 'user',
              text: message,
            },
          ],
        }),
      });

      eventsource.onmessage = (e: MessageEvent) => {
        if (abortController.current?.signal.aborted) {
          return;
        }

        if (['DONE_GEN', 'DONE_STEP', 'DONE'].includes(e.data)) {
          return;
        }

        try {
          const extracted = AgentMessageSchema.parse(JSON.parse(e.data));

          queryClient.setQueriesData<InfiniteData<AgentMessage[]>>(
            {
              queryKey: UseAgentsServiceListAgentMessagesKeyFn({ agentId }),
            },
            // @ts-expect-error - the typing is wrong
            (oldData) => {
              if (!oldData) {
                return oldData;
              }

              const [firstPage, ...rest] = [...oldData.pages];

              let hasExistingMessage = false;

              let transformedFirstPage = firstPage.map((message) => {
                if (
                  `${message.id}-${message.message_type}` ===
                  `${extracted.id}-${extracted.message_type}`
                ) {
                  hasExistingMessage = true;

                  const newMessage: Record<string, any> = {
                    ...message,
                  };

                  // explicit handlers for each message type
                  switch (extracted.message_type) {
                    case 'function_call': {
                      const maybeArguments = get(
                        newMessage,
                        'function_call.arguments',
                        ''
                      );

                      newMessage.function_call = {
                        message_type:
                          newMessage.function_call.message_type ||
                          extracted.function_call.message_type,
                        name:
                          newMessage.function_call.name ||
                          extracted.function_call.name,
                        arguments:
                          maybeArguments + extracted.function_call.arguments,
                      };
                      break;
                    }
                    case 'function_return': {
                      newMessage.function_return = extracted.function_return;
                      break;
                    }
                    case 'internal_monologue': {
                      newMessage.internal_monologue =
                        (newMessage.internal_monologue || '') +
                        extracted.internal_monologue;
                      break;
                    }
                    default: {
                      return newMessage;
                    }
                  }

                  return newMessage;
                }

                return message;
              });

              if (!hasExistingMessage) {
                transformedFirstPage = [
                  {
                    ...extracted,
                    date: new Date().toISOString(),
                  },
                  ...transformedFirstPage,
                ];
              }

              return {
                pageParams: oldData.pageParams,
                pages: [transformedFirstPage, ...rest],
              };
            }
          );
        } catch (_e) {
          // ignore
        }

        if (e.eventPhase === eventsource.CLOSED) {
          void queryClient.invalidateQueries({
            queryKey: UseAgentsServiceListAgentMessagesKeyFn({ agentId }),
          });

          setIsPending(false);
          return;
        }
      };

      eventsource.onerror = () => {
        setIsPending(false);
      };
    },
    [agentId, queryClient]
  );

  return { isPending, sendMessage };
}

interface ChatroomContextType {
  renderMode: MessagesDisplayMode;
  setRenderMode: Dispatch<SetStateAction<ChatroomContextType['renderMode']>>;
}

const ChatroomContext = React.createContext<ChatroomContextType>({
  renderMode: 'debug',
  setRenderMode: () => {
    return;
  },
});

function ControlChatroomRenderMode() {
  const t = useTranslations('ADE/AgentSimulator');
  const { renderMode, setRenderMode } = React.useContext(ChatroomContext);

  return (
    <RawToggleGroup
      border
      onValueChange={(value) => {
        if (value) {
          setRenderMode(value as MessagesDisplayMode);
        }
      }}
      value={renderMode}
      label={t('setChatroomRenderMode.label')}
      hideLabel
      items={[
        {
          icon: <CodeIcon />,
          label: t('setChatroomRenderMode.options.debug'),
          value: 'debug',
          hideLabel: true,
        },
        {
          icon: <ChatBubbleIcon />,
          label: t('setChatroomRenderMode.options.simple'),
          value: 'simple',
          hideLabel: true,
        },
      ]}
    />
  );
}

interface DialogSessionDialogProps {
  variables: string[];
  existingVariables: Record<string, string>;
}

function DialogSessionSheet(props: DialogSessionDialogProps) {
  const t = useTranslations('ADE/AgentSimulator');
  const { variables, existingVariables } = props;
  const { id: projectId } = useCurrentProject();
  const { agentId: agentTemplateId } = useCurrentAgentMetaData();

  const [variableData, setVariableData] =
    useState<Record<string, string>>(existingVariables);

  const queryClient = useQueryClient();

  const { mutate, isPending } =
    webApi.agentTemplates.createAgentTemplateSimulatorSession.useMutation({
      onSuccess: (response) => {
        queryClient.setQueriesData<GetAgentTemplateSimulatorSessionResponseBody>(
          {
            queryKey: webApiQueryKeys.agentTemplates.getAgentTemplateSession({
              agentTemplateId,
              projectId,
            }),
          },
          () => {
            return {
              status: 200,
              body: response.body,
            };
          }
        );
      },
    });

  const handleUpdateSession = useCallback(() => {
    const validVariableNames = new Set(variables);

    const cleanedVariableData = Object.fromEntries(
      Object.entries(variableData)
        .filter(
          ([variableName, value]) =>
            value && validVariableNames.has(variableName)
        )
        .map(([variableName, value]) => [variableName, value])
    );

    const cleanedExistingVariables = Object.fromEntries(
      Object.entries(existingVariables)
        .filter(
          ([variableName, value]) =>
            value && validVariableNames.has(variableName)
        )
        .map(([variableName, value]) => [variableName, value])
    );

    // if variables are not different, don't update
    if (isEqual(cleanedVariableData, cleanedExistingVariables)) {
      return;
    }

    mutate({
      params: {
        agentTemplateId,
        projectId,
      },
      body: {
        variables: cleanedVariableData,
      },
    });
  }, [
    agentTemplateId,
    mutate,
    projectId,
    existingVariables,
    variableData,
    variables,
  ]);

  const debouncedUpdateSession = useDebouncedCallback(handleUpdateSession, 500);

  useEffect(() => {
    if (isPending) {
      return;
    }

    debouncedUpdateSession();
  }, [
    agentTemplateId,
    isPending,
    projectId,
    props.existingVariables,
    variables,
    variableData,
    handleUpdateSession,
    debouncedUpdateSession,
  ]);

  const handleChange = useCallback((name: string, value: string) => {
    setVariableData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  if (!variables.length) {
    return (
      <VStack borderBottom padding="small">
        <Alert
          title={t('DialogSessionSheet.noVariablesDefined', {
            variableName: '{{variableName}}',
          })}
          variant="info"
        />
      </VStack>
    );
  }

  return (
    <VStack position="relative" borderBottom padding="small">
      <HStack fullWidth position="absolute">
        {isPending && <ProgressBar indeterminate />}
      </HStack>
      <VStack border gap={false} borderBottom>
        <Table>
          <TableBody>
            {variables.map((variable) => (
              <TableRow key={variable}>
                <TableCell>
                  <Typography>{variable}</Typography>
                </TableCell>
                <TableCellInput
                  value={variableData[variable] || ''}
                  label={t('DialogSessionSheet.label')}
                  placeholder={t('DialogSessionSheet.placeholder')}
                  onChange={(e) => {
                    handleChange(variable, e.target.value);
                  }}
                />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </VStack>
    </VStack>
  );
}

export interface GenerateAgentStateHashResponse extends Partial<AgentState> {
  datasources: string[];
}

export function generateAgentStateHash(
  agentState: Partial<AgentState>,
  datasources: Source[]
): GenerateAgentStateHashResponse {
  return {
    ...agentState,
    datasources: datasources.map((source) => source.id || '').filter(Boolean),
  };
}

function Chatroom() {
  const t = useTranslations('ADE/AgentSimulator');
  const agentState = useCurrentAgent();
  const [showVariablesMenu, setShowVariablesMenu] = useState(false);
  const { id: agentId } = agentState;
  const [renderMode, setRenderMode] = useLocalStorage<MessagesDisplayMode>({
    defaultValue: 'debug',
    key: 'chatroom-render-mode',
  });

  const variableList = useMemo(() => {
    return findMemoryBlockVariables(agentState);
  }, [agentState]);

  const { isLocal } = useCurrentAgentMetaData();
  const { id: agentIdToUse, agentSession } = useCurrentSimulatedAgent();

  const mounted = useRef(false);

  const hasVariableMismatch = useMemo(() => {
    // check if variable mismatch
    const sessionVariables = agentSession?.body.variables || {};

    // it's ok if there's more variables defined in the session than in the agent, but not the other way around
    return variableList.some((variable) => !sessionVariables[variable]);
  }, [agentSession?.body.variables, variableList]);

  const agentStateStore = useRef<GenerateAgentStateHashResponse>(
    generateAgentStateHash(agentState, [])
  );

  const { mutate: updateSession } =
    webApi.agentTemplates.refreshAgentTemplateSimulatorSession.useMutation({
      onError: () => {
        toast.error(t('refreshError'));
      },
    });

  const { data: sourceList } = useAgentsServiceGetAgentSources({
    agentId: agentState.id || '',
  });

  const debounceUpdateSession = useDebouncedCallback(updateSession, 2000);

  useEffect(() => {
    if (!agentSession?.body.id) {
      return;
    }

    // update session just in case
    if (!mounted.current) {
      debounceUpdateSession({
        params: {
          agentSessionId: agentSession.body.id,
          agentTemplateId: agentId,
        },
      });
    }

    mounted.current = true;
  }, [agentId, agentSession?.body.id, debounceUpdateSession, updateSession]);

  useEffect(() => {
    if (!agentSession?.body.id) {
      return;
    }

    const currentState = generateAgentStateHash(agentState, sourceList || []);

    // check if the agent state has changed
    if (isEqual(currentState, agentStateStore.current)) {
      return;
    }

    agentStateStore.current = currentState;

    // update the existing session
    debounceUpdateSession({
      params: {
        agentSessionId: agentSession?.body.id,
        agentTemplateId: agentId,
      },
    });
  }, [
    agentId,
    agentSession?.body.id,
    agentState,
    debounceUpdateSession,
    sourceList,
  ]);

  const { sendMessage, isPending } = useSendMessage(agentIdToUse || '');

  const hasVariableIssue = useMemo(() => {
    return hasVariableMismatch;
  }, [hasVariableMismatch]);

  return (
    <ChatroomContext.Provider value={{ renderMode, setRenderMode }}>
      <VStack gap={false} fullHeight fullWidth>
        <PanelBar actions={<ControlChatroomRenderMode />}>
          <VStack paddingLeft="small">
            <Button
              onClick={() => {
                setShowVariablesMenu((v) => !v);
              }}
              active={showVariablesMenu}
              preIcon={
                hasVariableIssue ? (
                  <WarningIcon color="warning" />
                ) : (
                  <VariableIcon />
                )
              }
              color="tertiary"
              label={
                !hasVariableIssue && showVariablesMenu
                  ? t('hideVariables')
                  : t('showVariables')
              }
            />
          </VStack>
        </PanelBar>
        {showVariablesMenu && (
          <VStack>
            {isLocal ? (
              <HStack padding="small">
                <Alert title={t('localAgent')} variant="info" />
              </HStack>
            ) : (
              <DialogSessionSheet
                existingVariables={agentSession?.body.variables || {}}
                variables={variableList}
              />
            )}
          </VStack>
        )}
        <VStack collapseHeight gap={false} fullWidth>
          <VStack gap="large" collapseHeight>
            <VStack collapseHeight position="relative">
              {!agentIdToUse ? (
                <LoadingEmptyStatusComponent emptyMessage="" isLoading />
              ) : (
                <Messages
                  mode={renderMode}
                  isPanelActive
                  isSendingMessage={isPending}
                  agentId={agentIdToUse || ''}
                />
              )}
            </VStack>
            <ChatInput
              disabled={!agentIdToUse}
              sendingMessageText={t('sendingMessage')}
              onSendMessage={sendMessage}
              isSendingMessage={isPending}
            />
          </VStack>
        </VStack>
      </VStack>
    </ChatroomContext.Provider>
  );
}

export const agentSimulatorTemplate = {
  templateId: 'agent-simulator',
  useGetTitle: () => 'Agent Simulator',
  content: Chatroom,
  data: z.undefined(),
} satisfies PanelTemplate<'agent-simulator'>;
