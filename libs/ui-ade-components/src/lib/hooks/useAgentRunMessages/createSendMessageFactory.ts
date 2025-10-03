import { v4 as uuidv4 } from 'uuid';
import type {
  LettaMessageUnion,
  Run,
  SendMessageData,
  LettaUserMessageContentUnion,
  MessageCreate, ApprovalResponseMessage
} from '@letta-cloud/sdk-core';
import type { RunError, RunResponse, RunResponseMessage } from './agentRunManager.types';

interface SendMessageFactoryOptions {
  agentId: string;
  onUpdate: (runResponse: RunResponse) => void;
  signal?: AbortSignal;
  baseUrl: string;
  headers: Record<string, string>;
}

/**
 * Parses and normalizes content from MessageCreate to match UserMessage content type
 */
function parseMessageContent(msg: MessageCreate): string | LettaUserMessageContentUnion[] {
  if (!msg.content) {
    return '';
  }

  // If it's already a string, return as-is
  if (typeof msg.content === 'string') {
    return msg.content;
  }

  // If it's an array, filter to only allowed user message content types
  if (Array.isArray(msg.content)) {
    const filtered = msg.content.filter((item): item is LettaUserMessageContentUnion => {
      if (!item || typeof item !== 'object') return false;
      const type = (item as any).type;
      // Only text and image are valid for UserMessage
      return type === 'text' || type === 'image';
    });

    return filtered.length > 0 ? filtered : '';
  }

  // Fallback: convert to JSON string
  return JSON.stringify(msg.content);
}

/**
 * Validates if a parsed message is a valid LettaMessageUnion.
 * Uses exhaustive type checking to ensure all message types are handled.
 * Returns true if valid, false if unknown.
 */
function isValidLettaMessage(message: any): message is RunResponseMessage {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const messageType = message.message_type;

  // Exhaustive check of all LettaMessageUnion types
  switch (messageType) {
    case 'system_message':
    case 'user_message':
    case 'reasoning_message':
    case 'hidden_reasoning_message':
    case 'tool_call_message':
    case 'tool_return_message':
    case 'assistant_message':
    case 'approval_request_message':
    case 'approval_response_message':
    case 'usage_statistics':
    case 'stop_reason':
    case 'ping':
      return true;
    case 'unknown':
    case 'run_error_message':
    default:
      // If a new message type is added to LettaMessageUnion, TypeScript will error here
      // because messageType won't be exhaustively checked
      const _exhaustiveCheck: never = messageType as never;
      return false;
  }
}

export function createSendMessageFactory(options: SendMessageFactoryOptions) {
  const { agentId, onUpdate, signal, baseUrl, headers } = options;

  return async function sendMessage(payload: SendMessageData): Promise<void> {
    // Generate temporary run with UUID
    const tempRunId = uuidv4();
    const tempRun: Run = {
      id: tempRunId,
      agent_id: agentId,
      created_at: new Date().toISOString(),
      status: 'running',
    };

    // Map all request messages to LettaMessageUnion
    const initialMessages: LettaMessageUnion[] = (payload.requestBody.messages || []).map((msg): LettaMessageUnion => {
      // Check if it's an ApprovalCreate message
      if ('type' in msg && msg.type === 'approval' && 'approval_request_id' in msg) {
        // Map to ApprovalResponseMessage
        const approvalMessage: ApprovalResponseMessage = {
          id: uuidv4(),
          message_type: 'approval_response_message',
          approve: msg.approve,
          approval_request_id: msg.approval_request_id,
          date: new Date().toISOString(),
        };

        if (msg.reason && typeof msg.reason === 'string') {
          approvalMessage.reason = msg.reason;
        }

        return approvalMessage;
      }

      // Otherwise it's a MessageCreate - map to UserMessage or SystemMessage
      if (!('role' in msg)) {
        // Shouldn't happen, but handle gracefully
        return {
          id: uuidv4(),
          message_type: 'user_message',
          otid: uuidv4(),
          sender_id: '',
          content: '',
          date: new Date().toISOString(),
        };
      }

      const role = msg.role;

      if (role === 'user') {
        return {
          id: uuidv4(),
          message_type: 'user_message',
          otid: 'otid' in msg ? msg.otid : uuidv4(),
          sender_id: 'sender_id' in msg ? msg.sender_id || '' : '',
          content: parseMessageContent(msg),
          date: new Date().toISOString(),
        };
      } else if (role === 'system') {
        return {
          id: uuidv4(),
          message_type: 'system_message',
          sender_id: 'sender_id' in msg ? msg.sender_id || '' : '',
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || ''),
          date: new Date().toISOString(),
        };
      }

      // Fallback to user_message if role is unexpected (assistant role)
      return {
        id: uuidv4(),
        message_type: 'user_message',
        otid: 'otid' in msg ? msg.otid : uuidv4(),
        sender_id: 'sender_id' in msg ? msg.sender_id || '' : '',
        content: parseMessageContent(msg),
        date: new Date().toISOString(),
      };
    });

    // Create initial RunResponse with localRunId for tracking before server responds
    const initialRunResponse: RunResponse = {
      run: tempRun,
      localRunId: tempRunId,
      messages: initialMessages,
      requestError: null,
    };

    // Publish initial state immediately
    onUpdate(initialRunResponse);

    let actualRunId: string | null = null;
    let currentMessages: RunResponseMessage[] = [...initialRunResponse.messages];

    try {
      // Check if already aborted
      if (signal?.aborted) {
        const abortedResponse: RunResponse = {
          run: actualRunId ? { ...tempRun, id: actualRunId } : tempRun,
          localRunId: tempRunId,
          messages: currentMessages,
          requestError: { type: 'ABORT_ERROR' },
        };
        onUpdate(abortedResponse);
        return;
      }

      // Prepare request body matching useSendMessage format
      const requestBody = {
        ...payload.requestBody,
        stream_steps: true,
        stream_tokens: true,
        include_pings: true,
        background: true,
      };

      // Make fetch request
      const response = await fetch(
        `${baseUrl}/v1/agents/${agentId}/messages/stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...headers,
          },
          body: JSON.stringify(requestBody),
          signal,
        }
      );

      // Handle non-OK responses
      if (!response.ok) {
        const body = await response.json();
        const requestError = handleHttpError(response.status, body);

        const errorResponse: RunResponse = {
          run: actualRunId ? { ...tempRun, id: actualRunId } : tempRun,
          localRunId: tempRunId,
          messages: currentMessages,
          requestError,
        };
        onUpdate(errorResponse);
        return;
      }

      // Process the stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        const errorResponse: RunResponse = {
          run: actualRunId ? { ...tempRun, id: actualRunId } : tempRun,
          localRunId: tempRunId,
          messages: currentMessages,
          requestError: { type: 'INTERNAL_SERVER_ERROR' },
        };
        onUpdate(errorResponse);
        return;
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        if (signal?.aborted) {
          await reader.cancel();
          const abortedResponse: RunResponse = {
            run: actualRunId ? { ...tempRun, id: actualRunId } : tempRun,
            localRunId: tempRunId,
            messages: currentMessages,
            requestError: { type: 'ABORT_ERROR' },
          };
          onUpdate(abortedResponse);
          return;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim() === '') continue;

          // Parse SSE format: "data: {json}"
          let data = line;
          if (line.startsWith('data: ')) {
            data = line.substring(6);
          }

          if (data.trim() === '[DONE]') {
            // Stream completed successfully
            const finalResponse: RunResponse = {
              run: actualRunId
                ? { ...tempRun, id: actualRunId, status: 'completed' }
                : { ...tempRun, status: 'completed' },
              localRunId: tempRunId,
              messages: currentMessages,
            };
            onUpdate(finalResponse);
            continue;
          }

          // Try to parse the message
          let parsedData: any;
          try {
            parsedData = JSON.parse(data);
          } catch (_e) {
            // Invalid JSON, add as unknown message
            const unknownMessage: RunResponseMessage = {
              id: uuidv4(),
              message_type: 'unknown',
              contents: data,
            };
            currentMessages.push(unknownMessage);

            const updatedResponse: RunResponse = {
              run: actualRunId ? { ...tempRun, id: actualRunId } : tempRun,
              localRunId: tempRunId,
              messages: currentMessages,
            };
            onUpdate(updatedResponse);
            continue;
          }

          // Validate it's a known message type
          if (!isValidLettaMessage(parsedData)) {
            // Unknown message type, add as unknown message
            const unknownMessage: RunResponseMessage = {
              id: uuidv4(),
              message_type: 'unknown',
              contents: parsedData,
            };
            currentMessages.push(unknownMessage);

            const updatedResponse: RunResponse = {
              run: actualRunId ? { ...tempRun, id: actualRunId } : tempRun,
              localRunId: tempRunId,
              messages: currentMessages,
            };
            onUpdate(updatedResponse);
            continue;
          }



          // At this point, parsedData is a valid LettaMessageUnion
          const extracted = parsedData

          // if no id, assign one
          if (!('id' in extracted) || !extracted.id) {
            // @ts-ignore
            extracted.id = uuidv4();
          }

          if (!('id' in extracted) || !extracted.id) {
            // Shouldn't happen due to above check, but just in case
            continue;
          }

          // Update run_id if present
          if ('run_id' in extracted && extracted.run_id && !actualRunId) {
            actualRunId = extracted.run_id;
          }

          // Find or create message
          const messageKey = `${extracted.id}-${extracted.message_type}`;
          const existingIndex = currentMessages.findIndex(
            (msg) => 'id' in msg && `${msg.id}-${msg.message_type}` === messageKey
          );

          if (existingIndex !== -1) {
            // Update existing message with new content
            const existingMessage = currentMessages[existingIndex];

            // Type guard to ensure we're not updating an UnknownMessage
            if (existingMessage.message_type === 'unknown') {
              continue;
            }

            const updatedMessage = { ...existingMessage };

            // Handle different message types
            switch (extracted.message_type) {
              case 'tool_call_message': {
                if ('tool_call' in updatedMessage && 'tool_call' in extracted) {
                  const existingArgs = updatedMessage.tool_call?.arguments || '';
                  updatedMessage.tool_call = {
                    ...updatedMessage.tool_call,
                    tool_call_id: extracted.tool_call?.tool_call_id || updatedMessage.tool_call?.tool_call_id,
                    name: extracted.tool_call?.name || updatedMessage.tool_call?.name,
                    arguments: existingArgs + (extracted.tool_call?.arguments || ''),
                  };
                }
                break;
              }
              case 'assistant_message': {
                if ('content' in updatedMessage && 'content' in extracted) {
                  const prev = updatedMessage.content;
                  const next = extracted.content;

                  if (typeof prev === 'string' && typeof next === 'string') {
                    updatedMessage.content = prev + next;
                  } else if (Array.isArray(prev) || Array.isArray(next)) {
                    const prevArr = Array.isArray(prev) ? prev : [{ type: 'text' as const, text: String(prev) }];
                    const nextArr = Array.isArray(next) ? next : [{ type: 'text' as const, text: String(next) }];
                    updatedMessage.content = [...prevArr, ...nextArr];
                  }
                }
                break;
              }
              case 'reasoning_message': {
                if ('reasoning' in updatedMessage && 'reasoning' in extracted && extracted.reasoning !== undefined) {
                  updatedMessage.reasoning = (updatedMessage.reasoning || '') + extracted.reasoning;
                }
                break;
              }
              case 'tool_return_message': {
                if ('tool_return' in updatedMessage && 'tool_return' in extracted) {
                  updatedMessage.tool_return = extracted.tool_return;
                }
                break;
              }
            }

            currentMessages = [
              ...currentMessages.slice(0, existingIndex),
              updatedMessage as LettaMessageUnion,
              ...currentMessages.slice(existingIndex + 1),
            ];
          } else {
            // Add new message (extracted is already typed as LettaMessageUnion from the type guard)
            currentMessages = [...currentMessages, extracted];
          }

          // Publish update
          const updatedResponse: RunResponse = {
            run: actualRunId ? { ...tempRun, id: actualRunId } : tempRun,
            localRunId: tempRunId,
            messages: currentMessages,
          };
          onUpdate(updatedResponse);
        }
      }

      // Final update after stream completes
      const finalResponse: RunResponse = {
        run: actualRunId
          ? { ...tempRun, id: actualRunId, status: 'completed' }
          : { ...tempRun, status: 'completed' },
        localRunId: tempRunId,
        messages: currentMessages,
      };
      onUpdate(finalResponse);
    } catch (error: unknown) {
      // Handle request-level errors
      const requestError = handleResponseError(error);

      const errorResponse: RunResponse = {
        run: actualRunId ? { ...tempRun, id: actualRunId } : tempRun,
        localRunId: tempRunId,
        messages: currentMessages,
        requestError,
      };
      onUpdate(errorResponse);
    }
  };
}

function handleHttpError(status: number, body: any): RunError {
  // Check for specific error reasons in body
  if (body.reasons) {
    if (body.reasons.includes('free-usage-exceeded')) {
      return { type: 'FREE_USAGE_EXCEEDED' };
    }
    if (body.reasons.includes('agents-limit-exceeded')) {
      return { type: 'AGENT_LIMIT_EXCEEDED' };
    }
    if (body.reasons.includes('premium-usage-exceeded')) {
      return { type: 'PREMIUM_USAGE_EXCEEDED' };
    }
  }

  // Check status codes
  if (status === 429) {
    return { type: 'RATE_LIMIT_EXCEEDED' };
  }
  if (status === 402) {
    return { type: 'CREDIT_LIMIT_EXCEEDED' };
  }
  if (status >= 500) {
    return { type: 'INTERNAL_SERVER_ERROR' };
  }

  return { type: 'UNKNOWN' };
}

function handleResponseError(error: unknown): RunError {
  if (!error || typeof error !== 'object') {
    return { type: 'UNKNOWN' };
  }

  const err = error as { name?: string; status?: number; body?: { error?: string } };

  // Handle abort errors
  if (err.name === 'AbortError' || err.name === 'CancelError') {
    return { type: 'ABORT_ERROR' };
  }

  // Handle network errors
  if (err.name === 'TypeError' || err.name === 'NetworkError') {
    return { type: 'NETWORK_ERROR' };
  }

  // Handle HTTP status codes
  if (err.status) {
    switch (err.status) {
      case 429:
        return { type: 'RATE_LIMIT_EXCEEDED' };
      case 402:
        // Check body for specific credit/usage errors
        if (err.body?.error) {
          if (err.body.error.includes('free usage')) {
            return { type: 'FREE_USAGE_EXCEEDED' };
          }
          if (err.body.error.includes('premium usage')) {
            return { type: 'PREMIUM_USAGE_EXCEEDED' };
          }
          if (err.body.error.includes('credit')) {
            return { type: 'CREDIT_LIMIT_EXCEEDED' };
          }
          if (err.body.error.includes('agent limit')) {
            return { type: 'AGENT_LIMIT_EXCEEDED' };
          }
        }
        return { type: 'CREDIT_LIMIT_EXCEEDED' };
      case 500:
      case 502:
      case 503:
      case 504:
        return { type: 'INTERNAL_SERVER_ERROR' };
      default:
        return { type: 'UNKNOWN' };
    }
  }

  return { type: 'UNKNOWN' };
}
