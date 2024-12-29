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
  FlushIcon,
  Skeleton,
} from '@letta-web/component-library';
import type { PanelTemplate, ChatInputRef } from '@letta-web/component-library';
import { PanelBar } from '@letta-web/component-library';
import { VStack } from '@letta-web/component-library';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { useEffect } from 'react';
import { useMemo } from 'react';
import React, { useCallback, useRef, useState } from 'react';
import type { AgentMessage, AgentState } from '@letta-web/letta-agents-api';
import { isAgentState } from '@letta-web/letta-agents-api';
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
import { get } from 'lodash-es';
import type { MessagesDisplayMode } from '$web/client/components';
import { Messages } from '$web/client/components';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useDebouncedCallback, useLocalStorage } from '@mantine/hooks';
import {
  webApi,
  webApiQueryKeys,
  webOriginSDKApi,
  webOriginSDKQueryKeys,
} from '$web/client';
import { useCurrentProject } from '../../../../../../(dashboard-like)/projects/[projectSlug]/hooks';
import { compareAgentStates, findMemoryBlockVariables } from '$web/utils';
import type { GetAgentTemplateSimulatorSessionResponseBody } from '$web/web-api/agent-templates/agentTemplatesContracts';
import { useCurrentSimulatedAgent } from '../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import { useCurrentAgentMetaData } from '../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { atom, useAtom, useSetAtom } from 'jotai';
import { trackClientSideEvent } from '@letta-web/analytics/client';
import { AnalyticsEvent } from '@letta-web/analytics';
import { useCurrentUser } from '$web/client/hooks';
import { messagesInFlightCacheAtom } from '$web/client/components/Messages/messagesInFlightCacheAtom/messagesInFlightCacheAtom';
import { useCurrentAPIHostConfig } from '$web/client/hooks/useCurrentAPIHostConfig/useCurrentAPIHostConfig';
import { jsonToCurl } from '@letta-web/generic-utils';
import type { ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$web/web-api/contracts';

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
  const abortController = useRef<AbortController>(undefined);
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

  const setMessagesInFlightCache = useSetAtom(messagesInFlightCacheAtom);

  const sendMessage: SendMessageType = useCallback(
    (payload: SendMessagePayload) => {
      const { text: message, role } = payload;
      setIsPending(true);
      setFailedToSendMessage(false);
      setErrorCode(undefined);

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

      setMessagesInFlightCache([newMessage]);

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
        },
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

          console.log('extracted', extracted);
          setMessagesInFlightCache((messages) => {
            if (!messages) {
              return messages;
            }

            let hasExistingMessage = false;

            let transformedMessages = messages.map((message) => {
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
                  case 'tool_call_message': {
                    const maybeArguments = get(
                      newMessage,
                      'tool_call.arguments',
                      '',
                    );

                    newMessage.tool_call = {
                      tool_call_id:
                        newMessage.tool_call.tool_call_id ||
                        extracted.tool_call.tool_call_id,
                      message_type:
                        newMessage.tool_call.message_type ||
                        extracted.tool_call.message_type,
                      name:
                        newMessage.tool_call.name || extracted.tool_call.name,
                      arguments: maybeArguments + extracted.tool_call.arguments,
                    };
                    break;
                  }
                  case 'tool_return_message': {
                    newMessage.tool_return = extracted.tool_return;
                    break;
                  }
                  case 'reasoning_message': {
                    newMessage.reasoning =
                      (newMessage.reasoning || '') + extracted.reasoning;
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
              transformedMessages = [
                {
                  ...extracted,
                  date: new Date().toISOString(),
                },
                ...transformedMessages,
              ];
            }

            return transformedMessages as AgentMessage[];
          });
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
      setMessagesInFlightCache,
      setIsPending,
      user?.id,
    ],
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
          },
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
              },
            );
          },
        },
      );
    },
    [agentTemplateId, mutate, projectId, queryClient, variableData],
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

function FlushSimulationSessionDialog() {
  const [isOpen, setIsOpen] = useState(false);
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
          },
        );

        setIsOpen(false);
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
      isOpen={isOpen}
      trigger={
        <Button
          size="small"
          color="tertiary"
          preIcon={<FlushIcon />}
          hideLabel
          label={t('FlushSimulationSessionDialog.trigger')}
        />
      }
      title={t('FlushSimulationSessionDialog.title')}
      confirmText={t('FlushSimulationSessionDialog.confirm')}
      onConfirm={handleFlushSession}
      onOpenChange={setIsOpen}
    >
      <Typography>{t('FlushSimulationSessionDialog.description')}</Typography>
    </Dialog>
  );
}

function AgentFlushButton() {
  const { isTemplate } = useCurrentAgentMetaData();
  const { agentSession } = useCurrentSimulatedAgent();

  if (!(isTemplate && agentSession?.body.agentId)) {
    return null;
  }

  return <FlushSimulationSessionDialog />;
}

function AgentSimulatorOptionsMenu() {
  const t = useTranslations('ADE/AgentSimulator');

  const { id: agentId } = useCurrentSimulatedAgent();

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

  return (
    <>
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
      </DropdownMenu>
    </>
  );
}

function useAgentVariables() {
  const { isFromTemplate } = useCurrentAgentMetaData();
  const { id: agentId } = useCurrentAgent();
  return webOriginSDKApi.agents.getAgentVariables.useQuery({
    queryKey: webOriginSDKQueryKeys.agents.getAgentVariables(agentId),
    queryData: {
      params: {
        agent_id: agentId,
      },
    },
    enabled: isFromTemplate,
  });
}

function DeployedAgentVariables() {
  const t = useTranslations('ADE/AgentSimulator');
  const { data } = useAgentVariables();

  const variableList = useMemo(() => {
    return Object.entries(data?.body.variables || {}) || [];
  }, [data]);

  if (!data) {
    return (
      <HStack borderBottom padding="small">
        <Skeleton
          /* eslint-disable-next-line react/forbid-component-props */
          className="w-full h-[30px]"
        />
        <Skeleton
          /* eslint-disable-next-line react/forbid-component-props */
          className="w-full h-[30px]"
        />
      </HStack>
    );
  }

  if (!variableList.length) {
    return (
      <HStack padding="small">
        <Alert title={t('noVariablesInDeployedAgent')} variant="info" />
      </HStack>
    );
  }

  return (
    <VStack
      color="background-grey"
      position="relative"
      borderBottom
      borderTop
      padding="small"
    >
      <Table>
        <TableBody>
          {variableList.map(([variable, value]) => (
            <TableRow key={variable}>
              <TableCell>
                <Typography variant="body2">{variable}</Typography>
              </TableCell>
              <TableCellInput
                value={value}
                label={t('DialogSessionSheet.label')}
                placeholder={t('DialogSessionSheet.placeholder')}
              />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </VStack>
  );
}

interface VariableMenuWrapperProps {
  variableList: string[];
  existingVariables: ServerInferResponses<
    typeof contracts.agentTemplates.getAgentTemplateSimulatorSession,
    200
  >['body']['variables'];
}

function VariableMenuWrapper(props: VariableMenuWrapperProps) {
  const { isLocal, isTemplate, isFromTemplate } = useCurrentAgentMetaData();
  const t = useTranslations('ADE/AgentSimulator');
  const { variableList, existingVariables } = props;

  if (isLocal) {
    return (
      <HStack padding="small">
        <Alert title={t('localAgent')} variant="info" />
      </HStack>
    );
  }

  if (!isTemplate) {
    if (!isFromTemplate) {
      return (
        <HStack padding="small">
          <Alert
            title={t('noVariablesInDeployedAgentWithNoTemplate')}
            variant="info"
          />
        </HStack>
      );
    }

    return <DeployedAgentVariables />;
  }

  return (
    <DialogSessionSheet
      existingVariables={existingVariables}
      variables={variableList}
    />
  );
}

function Chatroom() {
  useAgentVariables();
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

  const agentStateStore = useRef<AgentState>(agentState as AgentState);

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

    if (!isAgentState(agentState)) {
      return;
    }

    // check if the agent state has changed
    if (compareAgentStates(agentState, agentStateStore.current)) {
      return;
    }

    agentStateStore.current = agentState;

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

  const { isTemplate } = useCurrentAgentMetaData();
  const hostConfig = useCurrentAPIHostConfig({
    attachApiKey: false,
  });
  const getSendSnippet = useCallback(
    (role: string, message: string) => {
      if (isTemplate) {
        return undefined;
      }

      return jsonToCurl({
        url: `${hostConfig.url}/v1/agents/${agentIdToUse}/messages/stream`,
        headers: {
          ...hostConfig.headers,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: {
          messages: [{ role, text: message }],
          stream_steps: true,
          stream_tokens: true,
        },
        method: 'POST',
      });
    },
    [agentIdToUse, hostConfig.headers, hostConfig.url, isTemplate],
  );

  return (
    <ChatroomContext.Provider value={{ renderMode, setRenderMode }}>
      <VStack gap={false} fullHeight fullWidth>
        <PanelBar
          actions={
            <HStack>
              <ControlChatroomRenderMode />
              <AgentFlushButton />
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
            <VariableMenuWrapper
              variableList={variableList}
              existingVariables={agentSession?.body.variables || {}}
            />
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
              getSendSnippet={getSendSnippet}
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
