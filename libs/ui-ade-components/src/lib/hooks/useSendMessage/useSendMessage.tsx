'use client';
import type { RoleOption } from '@letta-cloud/ui-component-library';
import {
  AgentMessageSchema,
  ErrorMessageSchema,
  type ApprovalResponseMessage,
  type LettaMessageUnion,
  type LettaUserMessageContentUnion,
  type ListMessagesResponse,
  type SystemMessage,
  useAgentsServiceCancelAgentRun,
  UseAgentsServiceListMessagesKeyFn,
  type UserMessage,
} from '@letta-cloud/sdk-core';
import { useCurrentSimulatedAgent } from '../useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import { useLocalStorage } from '@mantine/hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { debounce, get } from 'lodash-es';
import type { z } from 'zod';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/query-core';
import { useAtom } from 'jotai/index';
import { isSendingMessageAtom } from '@letta-cloud/ui-ade-components';
import { useNetworkRequest } from '../useNetworkRequest/useNetworkRequest';
import { useFeatureFlag } from '@letta-cloud/sdk-web';
import { useLettaAgentsAPI } from '@letta-cloud/utils-client';
import { v4 as uuidv4 } from 'uuid';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';

type ErrorCode = z.infer<typeof ErrorMessageSchema>['code'];

interface DefaultMessage {
  type: 'default';
  role: RoleOption;
  content: LettaUserMessageContentUnion[] | string;
}

interface HITLMessage {
  type: 'approval';
  approve: boolean;
  approval_request_id: string;
  reason?: string;
}

interface SendMessagePayload {
  agentId: string;
  message: DefaultMessage | HITLMessage;
}

interface ResumeStreamPayload {
  agentId: string;
  overrideSeqId?: number;
}

const FAILED_ID = 'failed';
export type SendMessageType = (payload: SendMessagePayload) => void;

interface UseSendMessageOptions {
  onFailedToSendMessage?: (existingMessage: string) => void;
  onStreamCompletion?: () => void;
}

function extractMessageTextFromContent(
  content: LettaUserMessageContentUnion[] | string,
): string {
  if (typeof content === 'string') {
    return content;
  } else if (Array.isArray(content) && content.length > 0) {
    const textPart = content.find((part) => part && part.type === 'text');
    if (textPart && textPart.type === 'text') {
      return textPart.text;
    }
  }
  return '';
}

interface LastAgentRunData {
  [runId: string]: number; // seq_id
}

function useBackgroundMode() {
  const { id: currentAgentId } = useCurrentSimulatedAgent();

  const [_, setlastAgentRun] = useLocalStorage<LastAgentRunData>({
    key: currentAgentId,
    defaultValue: {},
  });

  // Debounced function to save seq_id
  const debouncedSaveSeqId = useMemo(
    () =>
      debounce((runId: string, seqId: number) => {
        setlastAgentRun((prev) => ({
          ...prev,
          [runId]: seqId,
        }));
      }, 100),
    [setlastAgentRun],
  );

  const handleBackgroundMode = useCallback(
    (extracted: z.infer<typeof AgentMessageSchema>) => {
      const runId = extracted.run_id;

      if (!runId || typeof runId !== 'string') return;

      // Save run_id - initialize with seq_id 0 if not exists
      setlastAgentRun((prev) => ({
        ...prev,
        [runId]: prev[runId] ?? 0,
      }));

      // Debounce seq_id updates (only thing that changes frequently)
      if ('seq_id' in extracted && typeof extracted.seq_id === 'number') {
        debouncedSaveSeqId(runId, extracted.seq_id);
      }
    },
    [debouncedSaveSeqId, setlastAgentRun],
  );

  const getAgentRuns = useCallback(() => {
    const agentRunsInStorage = localStorage.getItem(currentAgentId);
    if (!agentRunsInStorage) {
      return null;
    }

    const agentRuns = JSON.parse(agentRunsInStorage);

    // Get the first run ID directly since we currently only work with one run at a time
    const runId = Object.keys(agentRuns)[0];
    if (runId) {
      return { runId, seqId: agentRuns[runId] };
    }

    return null;
  }, [currentAgentId]);

  const removeRunIdFromBackgroundMode = useCallback(
    (runIdToRemove: string) => {
      debouncedSaveSeqId.cancel();

      setlastAgentRun((prev) => {
        const newData = { ...prev };
        delete newData[runIdToRemove];

        // If there's only one key-value pair left or none, remove the entire agent_id from localstorage
        if (Object.keys(newData).length <= 1) {
          // Return undefined to remove the localStorage key entirely with Mantine's useLocalStorage
          return undefined as any;
        }

        return newData;
      });
    },
    [debouncedSaveSeqId, setlastAgentRun],
  );

  const flushPendingSave = useCallback(() => {
    debouncedSaveSeqId.flush();
  }, [debouncedSaveSeqId]);

  // Flush pending localStorage saves on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushPendingSave();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [flushPendingSave]);

  return {
    handleBackgroundMode,
    removeRunIdFromBackgroundMode,
    flushPendingSave,
    getAgentRuns,
  };
}

function handleResponseError(
  response: Response,
  body: any,
  message: string,
  requestId: string,
  handleError: (
    message: string,
    errorCode: ErrorCode,
    responseData?: any,
  ) => void,
  updateNetworkRequest: (requestId: string, update: any) => void,
): boolean {
  if (body.reasons?.includes('free-usage-exceeded')) {
    handleError(message, 'FREE_USAGE_EXCEEDED', body);
    updateNetworkRequest(requestId, {
      status: response.status,
      response: body,
    });
    return true;
  }

  if (body.reasons?.includes('agents-limit-exceeded')) {
    handleError(message, 'AGENT_LIMIT_EXCEEDED', body);
    updateNetworkRequest(requestId, {
      status: response.status,
      response: body,
    });
    return true;
  }

  if (body.reasons?.includes('premium-usage-exceeded')) {
    handleError(message, 'PREMIUM_USAGE_EXCEEDED', body);
    updateNetworkRequest(requestId, {
      status: response.status,
      response: body,
    });
    return true;
  }

  if (response.status === 429) {
    handleError(message, 'RATE_LIMIT_EXCEEDED', body);
    updateNetworkRequest(requestId, {
      status: response.status,
      response: body,
    });
    return true;
  }

  if (response.status === 402) {
    handleError(message, 'CREDIT_LIMIT_EXCEEDED', body);
    updateNetworkRequest(requestId, {
      status: response.status,
      response: body,
    });
    return true;
  }

  return false;
}

function processAgentMessage(
  data: string,
  agentId: string,
  queryClient: QueryClient,
  isBackgroundModeEnabled: boolean,
  handleBackgroundMode: (extracted: z.infer<typeof AgentMessageSchema>) => void,
  setCurrentRunId: (runId: string | null) => void,
): string | null {
  try {
    // TODO (cliandy): handle {"message_type":"usage_statistics"} or don't pass through
    const extracted = AgentMessageSchema.parse(JSON.parse(data));

    if (isBackgroundModeEnabled) {
      handleBackgroundMode(extracted);
      // Track the current run_id for cleanup when streaming is done
      if (extracted.run_id) {
        setCurrentRunId(extracted.run_id);
      }
    }

    queryClient.setQueriesData<InfiniteData<ListMessagesResponse>>(
      {
        queryKey: UseAgentsServiceListMessagesKeyFn({ agentId }),
      },
      (data) => {
        if (!data) {
          return data;
        }

        const messages = data.pages[0] as LettaMessageUnion[];

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
                  name: newMessage.tool_call.name || extracted.tool_call.name,
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
            ...transformedMessages,
            {
              ...extracted,
              date: new Date().toISOString(),
            },
          ];
        }

        return {
          ...data,
          pages: [
            transformedMessages as LettaMessageUnion[],
            ...data.pages.slice(1),
          ],
        };
      },
    );

    return extracted.run_id || null;
  } catch (_e) {
    // ignore
    return null;
  }
}

interface HandleStreamResponse {
  response: Response;
  requestId: string;
  agentId: string;
  message: string;
  handleError: (
    message: string,
    errorCode: ErrorCode,
    responseData?: any,
  ) => void;
}

export function useSendMessage(options: UseSendMessageOptions = {}) {
  const [isPending, setIsPending] = useAtom(isSendingMessageAtom);
  const abortController = useRef<AbortController>(undefined);
  const queryClient = useQueryClient();
  const [failedToSendMessage, setFailedToSendMessage] = useState(false);
  const [errorCode, setErrorCode] = useState<ErrorCode | undefined>(undefined);
  const { addNetworkRequest, updateNetworkRequest } = useNetworkRequest();
  const { handleBackgroundMode, removeRunIdFromBackgroundMode, getAgentRuns } =
    useBackgroundMode();
  const { data: isBackgroundModeEnabled } = useFeatureFlag('BACKGROUND_MODE');

  const { baseUrl, password } = useLettaAgentsAPI();

  // Temporarily removing to diagnose SAD research agent
  // useEffect(() => {
  //   return () => {
  //     if (abortController.current) {
  //       abortController.current.abort();
  //     }
  //   };
  // }, []);

  const handleStreamResponse = useCallback(
    async function handleStreamResponse(opts: HandleStreamResponse) {
      const { response, requestId, agentId, message, handleError } = opts;
      let currentRunId: string | null = null;

      if (!response.ok) {
        const body = await response.json();

        const wasHandled = handleResponseError(
          response,
          body,
          message,
          requestId,
          handleError,
          updateNetworkRequest,
        );

        if (wasHandled) {
          return;
        }

        updateNetworkRequest(requestId, {
          status: response.status,
          response: body,
        });

        // if the run wasn't created in background mode, skip the error
        // if the run can't be found, skip
        if (isBackgroundModeEnabled) {
          if (currentRunId && body?.details?.detail) {
            const errorMessagesByBackgroundMode = new Set([
              '400: Run was not created in background mode, so it cannot be retrieved.',
              '404: Run not found',
            ]);

            if (errorMessagesByBackgroundMode.has(body.details.detail)) {
              removeRunIdFromBackgroundMode(currentRunId);
              return;
            }
          }
        }

        handleError(message, 'INTERNAL_SERVER_ERROR', body);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        handleError(message, 'INTERNAL_SERVER_ERROR', {
          error: 'No response reader available',
        });
        return;
      }

      let buffer = '';
      let allText = '';
      let data = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          setIsPending(false);
          void queryClient.invalidateQueries({
            queryKey: UseAgentsServiceListMessagesKeyFn({ agentId }),
          });
          break;
        }

        if (abortController.current?.signal.aborted) {
          await reader.cancel();
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim() === '') continue;

          // Parse SSE format: "data: {json}" or just "{json}"
          data = line;
          allText += `${data}\n`;
          if (line.startsWith('data: ')) {
            data = line.substring(6);
          }

          if (data.trim() === '[DONE]') {
            updateNetworkRequest(requestId, {
              status: 200,
              response: allText,
            });

            if (options?.onStreamCompletion) {
              options.onStreamCompletion();
            }

            if (isBackgroundModeEnabled && currentRunId) {
              removeRunIdFromBackgroundMode(currentRunId);
            }

            continue;
          }

          try {
            const errorMessage = ErrorMessageSchema.parse(JSON.parse(data));
            handleError(message, errorMessage.code, {
              streamData: allText,
              errorMessage,
            });
            return;
          } catch (_e) {
            // ignore
          }

          const runId = processAgentMessage(
            data,
            agentId,
            queryClient,
            isBackgroundModeEnabled || false,
            handleBackgroundMode,
            (runId) => {
              currentRunId = runId;
            },
          );
          if (runId) {
            currentRunId = runId;
          }
        }
      }
    },
    [
      queryClient,
      isBackgroundModeEnabled,
      handleBackgroundMode,
      removeRunIdFromBackgroundMode,
      setIsPending,
      updateNetworkRequest,
      options,
    ],
  );

  const resumeMessage = useCallback(
    async (payload: ResumeStreamPayload) => {
      const agentRuns = getAgentRuns();
      if (!agentRuns) {
        setIsPending(false);
        return;
      }

      abortController.current = new AbortController();

      const { runId, seqId } = agentRuns;

      const response = await fetch(`${baseUrl}/v1/runs/${runId}/stream`, {
        method: 'POST',
        headers: {
          'X-SOURCE-CLIENT': window.location.pathname,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(password
            ? {
                Authorization: `Bearer ${password}`,
                'X-BARE-PASSWORD': `password ${password}`,
              }
            : {}),
        },
        body: JSON.stringify({ starting_after: seqId || 0 }),
        signal: abortController.current.signal,
      });

      await handleStreamResponse({
        response,
        requestId: 'background-mode-resume', // not tracked in network requests
        agentId: payload.agentId,
        message: '',
        handleError: () => {
          // no-op, errors are handled in the main sendMessage flow
        },
      });

      setIsPending(true);
    },
    [baseUrl, password, getAgentRuns, handleStreamResponse, setIsPending],
  );

  const sendMessage: SendMessageType = useCallback(
    async (payload: SendMessagePayload) => {
      const agentId = payload.agentId;

      setIsPending(true);
      setFailedToSendMessage(false);
      setErrorCode(undefined);

      const userMessageOtid = uuidv4();

      const messageType = (() => {
        if (payload.message.type === 'approval') {
          return 'hitl_message';
        }

        return payload.message.role.value === 'system'
          ? 'system_message'
          : 'user_message';
      })();

      function handleError(
        message: string,
        errorCode: ErrorCode,
        responseData?: any,
      ) {
        setIsPending(false);
        setFailedToSendMessage(true);
        setErrorCode(errorCode);

        const eventTrackerPayload = {
          agent_id: agentId,
          message_sending_type: 'streaming',
          location: 'ade:agent_simulator',
          error_type: errorCode || 'UNKNOWN',
          error_message: JSON.stringify(responseData),
        };

        trackClientSideEvent(AnalyticsEvent.SEND_MESSAGE_FAILED, {
          ...eventTrackerPayload,
          message_type: messageType,
        });

        options?.onFailedToSendMessage?.(message);

        queryClient.setQueriesData<InfiniteData<ListMessagesResponse>>(
          {
            queryKey: UseAgentsServiceListMessagesKeyFn({ agentId }),
          },
          (data) => {
            if (!data) {
              return data;
            }

            return {
              ...data,
              pages: data.pages.map((page) => {
                const messages = page as LettaMessageUnion[];

                return messages.map((message) => {
                  if (
                    message.message_type === 'user_message' &&
                    message.otid === userMessageOtid
                  ) {
                    return {
                      ...message,
                      id: FAILED_ID,
                    };
                  }
                  return message;
                });
              }),
            };
          },
        );
      }

      abortController.current = new AbortController();

      let message = '';

      try {
        function generateMessage() {
          if (payload.message.type === 'approval') {
            const { approve, approval_request_id, reason } = payload.message;
            return {
              type: 'approval',
              approve,
              approval_request_id: approval_request_id,
              ...(reason ? { reason } : {}),
            };
          }
          const { role, content } = payload.message;

          return {
            role: role.value !== 'system' ? 'user' : 'system',
            ...(role.identityId ? { sender_id: role.identityId } : {}),
            content: content,
            otid: userMessageOtid,
          };
        }

        message =
          payload.message.type === 'default'
            ? extractMessageTextFromContent(payload.message.content)
            : '';

        const requestBody = {
          // extra config to turn off the AssistantMessage parsing for the ADE
          config: {
            use_assistant_message: false,
          },
          stream_steps: true,
          stream_tokens: true,
          background: isBackgroundModeEnabled || false,
          use_assistant_message: false,
          messages: [generateMessage()],
        };

        const requestId = addNetworkRequest({
          date: new Date(),
          url: `${baseUrl}/v1/agents/${agentId}/messages/stream`,
          method: 'POST',
          status: 200,
          payload: requestBody,
          response: 'RESULTS WILL APPEAR AFTER THE REQUEST IS COMPLETED',
        });

        trackClientSideEvent(AnalyticsEvent.SEND_MESSAGE, {
          agent_id: agentId,
          message_type: messageType,
          message_sending_type: 'streaming',
          location: 'ade:agent_simulator',
        });

        const newMessage:
          | SystemMessage
          | UserMessage
          | ApprovalResponseMessage = (() => {
          if (payload.message.type === 'approval') {
            return {
              message_type: 'approval_response_message',
              otid: userMessageOtid,
              sender_id: '',
              approve: payload.message.approve,
              approval_request_id: payload.message.approval_request_id,
              date: new Date().toISOString(),
              id: `${new Date().getTime()}-approval_response_message`,
            };
          }

          const { role, content } = payload.message;

          if (role.value === 'system') {
            return {
              message_type: 'system_message' as const,
              otid: userMessageOtid,
              sender_id: role.identityId || '',
              content: JSON.stringify({
                type: 'system_alert',
                message: message,
                time: new Date().toISOString(),
              }),
              date: new Date().toISOString(),
              id: `${new Date().getTime()}-user_message`,
            };
          }

          return {
            message_type: 'user_message' as const,
            otid: userMessageOtid,
            sender_id: role.identityId || '',
            content: content,
            date: new Date().toISOString(),
            id: `${new Date().getTime()}-user_message`,
          };
        })();

        queryClient.setQueriesData<InfiniteData<ListMessagesResponse>>(
          {
            queryKey: UseAgentsServiceListMessagesKeyFn({ agentId }),
          },
          (data) => {
            if (!data) {
              return data;
            }

            return {
              ...data,
              pages: data.pages.map((page) => [
                newMessage,
                ...(page as LettaMessageUnion[]).filter((v) => {
                  // remove any failed messages
                  if (v.id === FAILED_ID) {
                    return false;
                  }

                  return true;
                }),
              ]),
            };
          },
        );

        const response = await fetch(
          `${baseUrl}/v1/agents/${agentId}/messages/stream`,
          {
            method: 'POST',
            headers: {
              'X-SOURCE-CLIENT': window.location.pathname,
              'Content-Type': 'application/json',
              Accept: 'text/event-stream',
              ...(password
                ? {
                    Authorization: `Bearer ${password}`,
                    'X-BARE-PASSWORD': `password ${password}`,
                  }
                : {}),
            },
            body: JSON.stringify(requestBody),
            signal: abortController.current.signal,
          },
        );

        await handleStreamResponse({
          response,
          requestId,
          agentId,
          message,
          handleError,
        });
      } catch (error) {
        if (
          error instanceof TypeError &&
          (error.message === 'network error' || error.message === 'Load failed')
        ) {
          // Network error, allow backend request to continue
          if (isBackgroundModeEnabled) {
            void resumeMessage({
              agentId,
            });
          }
          return;
        }

        if (error instanceof Error && error.name === 'AbortError') {
          // Request was aborted, don't treat as error
          setIsPending(false);
          return;
        }

        // Handle other fetch errors
        setIsPending(false);
        setFailedToSendMessage(true);
        setErrorCode('INTERNAL_SERVER_ERROR');

        options?.onFailedToSendMessage?.(message);
      }
    },
    [
      addNetworkRequest,
      baseUrl,
      handleStreamResponse,
      isBackgroundModeEnabled,
      options,
      password,
      queryClient,
      resumeMessage,
      setIsPending,
    ],
  );

  const { mutateAsync: cancelAgentRun } = useAgentsServiceCancelAgentRun();
  const { data: isAgentRunCancellationV2Enabled } = useFeatureFlag(
    'AGENT_RUN_CANCELLATION_V2',
  );
  const stopMessage = useCallback(
    async (agentId: string) => {
      if (isAgentRunCancellationV2Enabled) {
        await cancelAgentRun(
          { agentId },
          {
            onSuccess: () => {
              if (abortController.current) {
                abortController.current.abort();
                setIsPending(false);
              }
            },
          },
        );
      } else {
        if (abortController.current) {
          abortController.current.abort();
          setIsPending(false);
        }
      }
    },
    [
      abortController,
      cancelAgentRun,
      isAgentRunCancellationV2Enabled,
      setIsPending,
    ],
  );

  return {
    isPending,
    isError: failedToSendMessage,
    sendMessage,
    resumeMessage,
    stopMessage,
    errorCode,
  };
}
