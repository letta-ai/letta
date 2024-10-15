'use client';
import {
  Button,
  ChatBubbleIcon,
  ChatInput,
  CodeIcon,
  Form,
  FormActions,
  FormField,
  FormProvider,
  LoadingEmptyStatusComponent,
  RawToggleGroup,
  Table,
  TableBody,
  TableCell,
  TableCellInput,
  TableRow,
  Typography,
  useForm,
  WarningIcon,
} from '@letta-web/component-library';
import type { PanelTemplate } from '@letta-web/component-library';
import { PanelBar } from '@letta-web/component-library';
import { VStack } from '@letta-web/component-library';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect } from 'react';
import { useMemo } from 'react';
import React, { useCallback, useRef, useState } from 'react';
import type { AgentMessage } from '@letta-web/letta-agents-api';
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
import { useCurrentAgentMetaData } from '../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { findMemoryBlockVariables } from '$letta/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { isFetchError } from '@ts-rest/react-query/v5';
import type { GetAgentTemplateSimulatorSessionResponseBody } from '$letta/web-api/agent-templates/agentTemplatesContracts';
import { isEqual } from 'lodash-es';

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
      size="small"
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
  const { variables } = props;
  const { id: projectId } = useCurrentProject();
  const { id: agentTemplateId } = useCurrentAgent();

  const schema = useMemo(() => {
    return z.object(
      Object.fromEntries(
        variables.map((variable) => [variable, z.string().optional()])
      )
    );
  }, [variables]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(
      variables.map((variable) => [variable, props.existingVariables[variable]])
    ),
  });

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

  const handleSubmit = useCallback(
    (values: Record<string, string>) => {
      mutate({
        params: {
          projectId,
          agentTemplateId,
        },
        body: {
          variables: values,
        },
      });
    },
    [agentTemplateId, mutate, projectId]
  );

  return (
    <VStack borderBottom paddingBottom="small">
      <FormProvider {...form}>
        <Form onSubmit={form.handleSubmit(handleSubmit)}>
          <VStack gap={false} borderBottom>
            <Table>
              <TableBody>
                {variables.map((variable) => (
                  <TableRow key={variable}>
                    <TableCell>
                      <Typography>{variable}</Typography>
                    </TableCell>
                    <FormField
                      name={variable}
                      render={({ field }) => (
                        <TableCellInput
                          label={t('DialogSessionSheet.label')}
                          placeholder={t('DialogSessionSheet.placeholder')}
                          {...field}
                        />
                      )}
                    />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </VStack>
          <FormActions>
            <Button
              busy={isPending}
              size="small"
              color="tertiary"
              label={t('DialogSessionSheet.update')}
            />
          </FormActions>
        </Form>
      </FormProvider>
    </VStack>
  );
}

function Chatroom() {
  const t = useTranslations('ADE/AgentSimulator');
  const agentState = useCurrentAgent();
  const [showVariablesMenu, setShowVariablesMenu] = useState(false);
  const { id: agentId } = agentState;
  const { isTemplate } = useCurrentAgentMetaData();
  const { id: projectId } = useCurrentProject();
  const [renderMode, setRenderMode] = useLocalStorage<MessagesDisplayMode>({
    defaultValue: 'debug',
    key: 'chatroom-render-mode',
  });

  const { data: agentSession, error } =
    webApi.agentTemplates.getAgentTemplateSimulatorSession.useQuery({
      queryKey: webApiQueryKeys.agentTemplates.getAgentTemplateSession({
        agentTemplateId: agentId,
        projectId,
      }),
      queryData: {
        params: {
          agentTemplateId: agentId,
          projectId,
        },
      },
      retry: false,
      enabled: isTemplate,
    });

  const variableList = useMemo(() => {
    return findMemoryBlockVariables(agentState);
  }, [agentState]);

  const agentIdToUse = useMemo(() => {
    if (isTemplate) {
      return agentSession?.body.agentId;
    }

    return agentId;
  }, [agentId, agentSession?.body.agentId, isTemplate]);

  const hasNoSimulatorSession = useMemo(() => {
    return isTemplate && !isFetchError(error) && error?.status === 404;
  }, [error, isTemplate]);

  const hasVariableMismatch = useMemo(() => {
    // check if variable mismatch

    const sessionVariables = agentSession?.body.variables || {};

    // it's ok if theres more variables defined in the session than in the agent, but not the other way around
    return variableList.some((variable) => !sessionVariables[variable]);
  }, [agentSession?.body.variables, variableList]);

  const agentStateStore = useRef(agentState);

  const { mutate: updateSession } =
    webApi.agentTemplates.refreshAgentTemplateSimulatorSession.useMutation();

  const debounceUpdateSession = useDebouncedCallback(updateSession, 500);

  useEffect(() => {
    if (!agentSession?.body.id) {
      return;
    }

    // check if the agent state has changed
    if (isEqual(agentState, agentStateStore.current)) {
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
  }, [agentId, agentSession?.body.id, agentState, debounceUpdateSession]);

  const { sendMessage, isPending } = useSendMessage(agentIdToUse || '');

  const hasVariableIssue = useMemo(() => {
    return hasVariableMismatch || hasNoSimulatorSession;
  }, [hasVariableMismatch, hasNoSimulatorSession]);

  return (
    <ChatroomContext.Provider value={{ renderMode, setRenderMode }}>
      <VStack fullHeight fullWidth>
        <PanelBar actions={<ControlChatroomRenderMode />}>
          <VStack paddingLeft="small">
            <Button
              onClick={() => {
                setShowVariablesMenu((v) => !v);
              }}
              preIcon={hasVariableIssue && <WarningIcon color="warning" />}
              size="small"
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
            <DialogSessionSheet
              existingVariables={agentSession?.body.variables || {}}
              variables={variableList}
            />
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
