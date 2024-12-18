import {
  Alert,
  Button,
  ChatBubbleIcon,
  ChatInput,
  ChatIcon,
  CodeIcon,
  ComputerIcon,
  Dialog,
  DotsHorizontalIcon,
  DropdownMenu,
  DropdownMenuItem,
  HStack,
  PersonIcon,
  RawToggleGroup,
  SystemIcon,
  Table,
  TableBody,
  TableCell,
  TableCellInput,
  TableRow,
  toast,
  Typography,
  VariableIcon,
  WarningIcon,
} from '@letta-web/component-library';
import type { PanelTemplate, ChatInputRef } from '@letta-web/component-library';
import { PanelBar } from '@letta-web/component-library';
import { VStack } from '@letta-web/component-library';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { useEffect } from 'react';
import { useMemo } from 'react';
import React, { useCallback, useRef, useState } from 'react';
import type {
  AgentMessage,
  AgentState,
  Source,
} from '@letta-web/letta-agents-api';
import { ErrorMessageSchema } from '@letta-web/letta-agents-api';
import { useLettaAgentsAPI } from '@letta-web/letta-agents-api';
import { getIsAgentState } from '@letta-web/letta-agents-api';
import { AgentsService } from '@letta-web/letta-agents-api';
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
import { webApi, webApiQueryKeys, webOriginSDKApi } from '$letta/client';
import { useCurrentProject } from '../../../../../../(dashboard-like)/projects/[projectSlug]/hooks';
import { findMemoryBlockVariables } from '$letta/utils';
import type { GetAgentTemplateSimulatorSessionResponseBody } from '$letta/web-api/agent-templates/agentTemplatesContracts';
import { isEqual } from 'lodash-es';
import { useCurrentSimulatedAgent } from '../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import { useCurrentAgentMetaData } from '../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { atom, useAtom } from 'jotai';
import { trackClientSideEvent } from '@letta-web/analytics/client';
import { AnalyticsEvent } from '@letta-web/analytics';
import { useCurrentUser } from '$letta/client/hooks';

const isSendingMessageAtom = atom(false);

type ErrorCode = z.infer<typeof ErrorMessageSchema>['code'];

interface SendMessagePayload {
  role: string;
  text: string;
}

export type SendMessageType = (payload: SendMessagePayload) => void;

interface UseSendMessageOptions {
  onFailedToSendMessage?: (existingMessage: string) => void;
}

function useSendMessage(agentId: string, options: UseSendMessageOptions = {}) {
  const [isPending, setIsPending] = useAtom(isSendingMessageAtom);
  const abortController = useRef<AbortController>();
  const queryClient = useQueryClient();
  const { isLocal } = useCurrentAgentMetaData();
  const user = useCurrentUser();
  const [failedToSendMessage, setFailedToSendMessage] = useState(false);
  const [errorCode, setErrorCode] = useState<ErrorCode | undefined>(undefined);

  const { baseUrl, password } = useLettaAgentsAPI();

  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  const sendMessage: SendMessageType = useCallback(
    (payload: SendMessagePayload) => {
      const { text: message, role } = payload;
      setIsPending(true);
      setFailedToSendMessage(false);
      setErrorCode(undefined);

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
            message_type: role === 'user' ? 'user_message' : 'system_message',
            message: JSON.stringify({
              type: role === 'user' ? 'user_message' : 'system_alert',
              message: message,
              time: new Date().toISOString(),
            }),
            date: new Date().toISOString(),
            id: `${new Date().getTime()}-user_message`,
          };

          const firstPageWithNewMessage = [newMessage, ...firstPage];

          return {
            pageParams: oldData.pageParams,
            pages: [firstPageWithNewMessage, ...rest],
          };
        }
      );

      if (isLocal) {
        trackClientSideEvent(AnalyticsEvent.LOCAL_AGENT_MESSAGE_CREATED, {
          userId: user?.id || '',
        });
      } else {
        trackClientSideEvent(AnalyticsEvent.CLOUD_AGENT_MESSAGE_CREATED, {
          userId: user?.id || '',
        });
      }

      abortController.current = new AbortController();

      const eventsource = new EventSource(
        `${baseUrl}/v1/agents/${agentId}/messages/stream`,
        {
          withCredentials: true,
          method: 'POST',
          disableRetry: true,
          keepalive: false,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(password ? { 'X-BARE-PASSWORD': `password ${password}` } : {}),
          },
          body: JSON.stringify({
            stream_steps: true,
            stream_tokens: true,
            messages: [
              {
                role,
                text: message,
              },
            ],
          }),
        }
      );

      eventsource.onmessage = (e: MessageEvent) => {
        if (abortController.current?.signal.aborted) {
          return;
        }

        if (['DONE_GEN', 'DONE_STEP', 'DONE'].includes(e.data)) {
          return;
        }

        try {
          const errorMessage = ErrorMessageSchema.parse(JSON.parse(e.data));
          setIsPending(false);
          setFailedToSendMessage(!!errorMessage.error);
          setErrorCode(errorMessage.code);
          options?.onFailedToSendMessage?.(message);
          return;
        } catch (_e) {
          // ignore
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
                        function_call_id:
                          newMessage.function_call.function_call_id ||
                          extracted.function_call.function_call_id,
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
    [
      agentId,
      baseUrl,
      isLocal,
      options,
      password,
      queryClient,
      setIsPending,
      user?.id,
    ]
  );

  return { isPending, isError: failedToSendMessage, sendMessage, errorCode };
}

interface ChatroomContextType {
  renderMode: MessagesDisplayMode;
  setRenderMode: Dispatch<SetStateAction<ChatroomContextType['renderMode']>>;
}

const ChatroomContext = React.createContext<ChatroomContextType>({
  renderMode: 'interactive',
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
      size="small"
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
          icon: <ChatIcon />,
          label: t('setChatroomRenderMode.options.interactive'),
          value: 'interactive',
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

  const handleUpdateSession = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      mutate(
        {
          params: {
            agentTemplateId,
            projectId,
          },
          body: {
            variables: variableData,
          },
        },
        {
          onSuccess: () => {
            queryClient.setQueriesData<
              GetAgentTemplateSimulatorSessionResponseBody | undefined
            >(
              {
                queryKey:
                  webApiQueryKeys.agentTemplates.getAgentTemplateSession({
                    agentTemplateId,
                    projectId,
                  }),
              },
              (oldData) => {
                if (!oldData) {
                  return oldData;
                }

                return {
                  status: 200,
                  body: {
                    ...oldData?.body,
                    variables: {
                      ...oldData?.body.variables,
                      ...variableData,
                    },
                  },
                };
              }
            );
          },
        }
      );
    },
    [agentTemplateId, mutate, projectId, queryClient, variableData]
  );

  const handleChange = useCallback((name: string, value: string) => {
    setVariableData((prev) => {
      return {
        ...prev,
        [name]: value,
      };
    });
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
    <form onSubmit={handleUpdateSession}>
      <VStack
        color="background-grey"
        position="relative"
        borderBottom
        paddingTop
        borderTop
        padding="small"
      >
        <VStack color="background" border gap={false} borderBottom>
          <Table>
            <TableBody>
              {variables.map((variable) => (
                <TableRow key={variable}>
                  <TableCell>
                    <Typography variant="body2">{variable}</Typography>
                  </TableCell>
                  <TableCellInput
                    testId={`variable-input-${variable}`}
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
        <HStack justify="end">
          <Button
            data-testid="save-variables-button"
            label={t('DialogSessionSheet.save')}
            size="small"
            busy={isPending}
            type="submit"
            color="secondary"
          />
        </HStack>
      </VStack>
    </form>
  );
}

interface FlushSimulationSessionDialogProps {
  onClose: () => void;
}

function FlushSimulationSessionDialog(
  props: FlushSimulationSessionDialogProps
) {
  const { onClose } = props;
  const t = useTranslations('ADE/AgentSimulator');
  const queryClient = useQueryClient();
  const { id: projectId } = useCurrentProject();
  const { agentId: agentTemplateId } = useCurrentAgentMetaData();
  const { agentSession } = useCurrentSimulatedAgent();

  const { mutate: createSession, isPending: isCreatingNewSession } =
    webApi.agentTemplates.createAgentTemplateSimulatorSession.useMutation({
      onSuccess: (response) => {
        toast.success(t('FlushSimulationSessionDialog.success'));

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

        onClose();
      },
    });

  const { mutate, isPending: isDeletingSession } =
    webApi.agentTemplates.deleteAgentTemplateSimulatorSession.useMutation({
      onSuccess: async () => {
        createSession({
          params: {
            agentTemplateId,
            projectId,
          },
          body: {
            variables: agentSession?.body.variables || {},
          },
        });
      },
      onError: () => {
        toast.error(t('FlushSimulationSessionDialog.error'));
      },
    });

  const isPending = useMemo(() => {
    return isCreatingNewSession || isDeletingSession;
  }, [isCreatingNewSession, isDeletingSession]);

  const handleFlushSession = useCallback(() => {
    mutate({
      params: {
        agentTemplateId,
        agentSessionId: agentSession?.body.id || '',
      },
    });
  }, [agentSession?.body.id, agentTemplateId, mutate]);

  return (
    <Dialog
      isConfirmBusy={isPending}
      isOpen
      title={t('FlushSimulationSessionDialog.title')}
      confirmText={t('FlushSimulationSessionDialog.confirm')}
      onConfirm={handleFlushSession}
      onOpenChange={(isOpen) => {
        if (!isOpen && onClose) {
          onClose();
        }
      }}
    >
      <Typography>{t('FlushSimulationSessionDialog.description')}</Typography>
    </Dialog>
  );
}

function AgentSimulatorOptionsMenu() {
  const { isTemplate } = useCurrentAgentMetaData();
  const t = useTranslations('ADE/AgentSimulator');

  const { agentSession, id: agentId } = useCurrentSimulatedAgent();

  const handlePrintDebug = useCallback(async () => {
    if (!agentId) {
      toast.error(t('AgentSimulatorOptionsMenu.options.printDebug.notReady'));

      return;
    }

    const [agentState, sources] = await Promise.all([
      webOriginSDKApi.agents.getAgentById.query({
        params: {
          agent_id: agentId,
        },
        query: {
          all: true,
        },
      }),
      AgentsService.getAgentSources({
        agentId: agentId,
      }),
    ]);

    console.table({
      agentState,
      sources,
    });

    toast.success(t('AgentSimulatorOptionsMenu.options.printDebug.success'));
  }, [agentId, t]);

  const [isFlushDialogOpen, setIsFlushDialogOpen] = useState(false);

  return (
    <>
      {isFlushDialogOpen && (
        <FlushSimulationSessionDialog
          onClose={() => {
            setIsFlushDialogOpen(false);
          }}
        />
      )}
      <DropdownMenu
        triggerAsChild
        align="end"
        trigger={
          <Button
            size="small"
            color="tertiary"
            preIcon={<DotsHorizontalIcon />}
            hideLabel
            title={t('AgentSimulatorOptionsMenu.trigger')}
          />
        }
      >
        <DropdownMenuItem
          onClick={handlePrintDebug}
          label={t('AgentSimulatorOptionsMenu.options.printDebug.title')}
        />
        {isTemplate && agentSession?.body.agentId && (
          <DropdownMenuItem
            onClick={() => {
              setIsFlushDialogOpen(true);
            }}
            label={t('AgentSimulatorOptionsMenu.options.flushSimulation')}
          />
        )}
      </DropdownMenu>
    </>
  );
}

export interface GenerateAgentStateHashResponse extends Partial<AgentState> {
  datasources: string[];
}

export function generateAgentStateHash(
  agentState: Partial<AgentState>,
  datasources: Source[]
): GenerateAgentStateHashResponse {
  const agentStateCopy = { ...agentState };

  if (agentStateCopy.memory?.blocks) {
    Object.keys(agentStateCopy.memory.blocks).forEach((_, index) => {
      if (agentStateCopy.memory) {
        agentStateCopy.memory.blocks[index].id = '';
      }
    });
  }

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
    defaultValue: 'interactive',
    key: 'chatroom-render-mode',
  });

  const variableList = useMemo(() => {
    if (!getIsAgentState(agentState)) {
      return [];
    }

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

  const ref = useRef<ChatInputRef | null>(null);

  const {
    sendMessage,
    isError: hasFailedToSendMessage,
    isPending,
    errorCode,
  } = useSendMessage(agentIdToUse || '', {
    onFailedToSendMessage: (message) => {
      ref.current?.setChatMessage(message);
    },
  });

  const hasVariableIssue = useMemo(() => {
    return hasVariableMismatch;
  }, [hasVariableMismatch]);

  const hasFailedToSendMessageText = useMemo(() => {
    if (!hasFailedToSendMessage) {
      return;
    }

    switch (errorCode) {
      case 'CONTEXT_WINDOW_EXCEEDED':
        return t('hasFailedToSendMessageText.contextWindowExceeded');
      case 'RATE_LIMIT_EXCEEDED':
        return t('hasFailedToSendMessageText.rateLimitExceeded');
      case 'INTERNAL_SERVER_ERROR':
      default:
        if (isLocal) {
          return t('hasFailedToSendMessageText.local');
        }
        return t('hasFailedToSendMessageText.cloud');
    }
  }, [hasFailedToSendMessage, isLocal, t, errorCode]);

  return (
    <ChatroomContext.Provider value={{ renderMode, setRenderMode }}>
      <VStack gap={false} fullHeight fullWidth>
        <PanelBar
          actions={
            <HStack>
              <ControlChatroomRenderMode />
              <AgentSimulatorOptionsMenu />
            </HStack>
          }
        >
          <VStack paddingLeft="small">
            <Button
              onClick={() => {
                setShowVariablesMenu((v) => !v);
              }}
              data-testid="toggle-variables-button"
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
              size="small"
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
              <Messages
                mode={renderMode}
                isPanelActive
                isSendingMessage={isPending}
                agentId={agentIdToUse || ''}
              />
            </VStack>
            <ChatInput
              disabled={!agentIdToUse}
              defaultRole="user"
              roles={[
                {
                  value: 'user',
                  label: t('role.user'),
                  icon: <PersonIcon />,
                  color: {
                    background: 'hsl(var(--user-color))',
                    text: 'hsl(var(--user-color-content))',
                  },
                },
                {
                  value: 'system',
                  label: t('role.system'),
                  icon: <SystemIcon />,
                },
              ]}
              ref={ref}
              hasFailedToSendMessageText={hasFailedToSendMessageText}
              sendingMessageText={t('sendingMessage')}
              onSendMessage={(role: string, text: string) => {
                sendMessage({ role, text });
              }}
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
  useGetMobileTitle: () => 'Simulator',
  icon: <ComputerIcon />,
  data: z.undefined(),
} satisfies PanelTemplate<'agent-simulator'>;
