import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type {
  ChatWithAgentBodySchemaType,
  ChatWithAgentParamsSchema,
} from '$letta/pdk/contracts/deployment';
import { ChatWithAgentBodySchema } from '$letta/pdk/contracts/deployment';
import type { z } from 'zod';
import { verifyAndReturnAPIKeyDetails } from '$letta/server/auth';
import { db, deployedAgents } from '@letta-web/database';
import { and, eq } from 'drizzle-orm';
import { EventSource } from 'extended-eventsource';
import { environment } from '@letta-web/environmental-variables';
import type { AgentMessage } from '@letta-web/letta-agents-api';
import { AgentMessageSchema } from '@letta-web/letta-agents-api';
import { AgentsService } from '@letta-web/letta-agents-api';
import { jsonrepair } from 'jsonrepair';
import { streamedArgumentsParserGenerator } from '$letta/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Context {
  params: z.infer<typeof ChatWithAgentParamsSchema>;
}

interface MessageParserOptions {
  return_message_types: ChatWithAgentBodySchemaType['return_message_types'];
}

function messagesParser(
  message: AgentMessage,
  options: MessageParserOptions
): AgentMessage | null {
  const nextMessage = { ...message };

  if (options.return_message_types) {
    if (!options.return_message_types.includes(nextMessage.message_type)) {
      return null;
    }
  }

  return nextMessage;
}

export async function POST(request: NextRequest, context: Context) {
  // get headers

  const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '');

  const keyDetails = await verifyAndReturnAPIKeyDetails(apiKey);

  if (!keyDetails) {
    return new Response('Unauthorized', { status: 401 });
  }

  // get body
  const body = ChatWithAgentBodySchema.safeParse(await request.json());

  if (!body.success) {
    return new Response(JSON.stringify(body.error), { status: 404 });
  }

  const {
    message,
    stream_tokens,
    return_message_types,
    format_function_call_arguments,
    return_function_calls,
  } = body.data;

  const agentDeploymentId = context.params.agentDeploymentId;
  const organizationId = keyDetails.organizationId;

  if (agentDeploymentId === ':agentDeploymentId') {
    return new Response(
      'You seem to have left :agentDeploymentId in the url path instead of specifying an agent Id.',
      { status: 400 }
    );
  }

  const deployedAgent = await db.query.deployedAgents.findFirst({
    where: and(
      eq(deployedAgents.organizationId, organizationId),
      eq(deployedAgents.id, agentDeploymentId)
    ),
  });

  if (!deployedAgent) {
    return new Response('Agent not found', { status: 404 });
  }

  if (!stream_tokens) {
    const messageResponse = await AgentsService.createAgentMessage({
      agentId: deployedAgent.agentId,
      requestBody: {
        stream_tokens: false,
        return_message_object: true,
        messages: [
          {
            role: 'user',
            text: message,
          },
        ],
      },
    });

    const response = messageResponse.messages
      .map((message) => {
        const safeMessage = AgentMessageSchema.safeParse(message);

        if (!safeMessage.success) {
          return null;
        }

        return messagesParser(safeMessage.data, { return_message_types });
      })
      .filter((message) => message !== null);

    return NextResponse.json(response, { status: 201 });
  }

  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();

  let closed = false;

  // Close if client disconnects
  request.signal.onabort = () => {
    if (closed) {
      return;
    }

    void writer.close();
  };

  setImmediate(async () => {
    const eventSource = new EventSource(
      `${environment.LETTA_AGENTS_ENDPOINT}/v1/agents/${deployedAgent.agentId}/messages`,
      {
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
              name: '',
            },
          ],
        }),
      }
    );

    let currentFunctionCall = '';

    const functionCallParser = streamedArgumentsParserGenerator();

    eventSource.onmessage = (e: MessageEvent) => {
      try {
        if (closed) {
          return;
        }

        if (e.eventPhase === eventSource.CLOSED) {
          closed = true;
          void responseStream.writable.close();
          eventSource.close();
          return;
        }

        if (e.data === '[DONE]') {
          void writer.write(`data: [DONE]\n\n`);
          return;
        }

        if (return_message_types) {
          try {
            const response = JSON.parse(jsonrepair(e.data));

            const agentMessage = AgentMessageSchema.safeParse(response);

            if (agentMessage.success) {
              let parsedMessage = messagesParser(agentMessage.data, {
                return_message_types,
              });

              if (parsedMessage) {
                if (return_function_calls) {
                  if (parsedMessage.message_type === 'function_call') {
                    if (parsedMessage.function_call.name) {
                      currentFunctionCall = parsedMessage.function_call.name;
                    }

                    if (
                      parsedMessage.function_call.arguments &&
                      format_function_call_arguments
                    ) {
                      functionCallParser.reader(
                        parsedMessage.function_call.arguments,
                        (result, options) => {
                          const passedMessage = options?.dataTransfer;

                          passedMessage.function_call.formattedArguments =
                            result;

                          void writer.write(
                            `data: ${JSON.stringify(passedMessage)}\n\n`
                          );
                        },
                        { dataTransfer: parsedMessage }
                      );

                      parsedMessage = null;
                    }

                    if (!return_function_calls.includes(currentFunctionCall)) {
                      parsedMessage = null;
                    }
                  } else {
                    // if not a function call, reset the current function call
                    currentFunctionCall = '';
                    functionCallParser.clear();
                  }
                }

                if (parsedMessage) {
                  void writer.write(
                    `data: ${JSON.stringify(parsedMessage)}\n\n`
                  );
                }
              }
            }
          } catch (_e) {
            // do nothing
          }

          return;
        }

        void writer.write(`data: ${e.data}\n\n`);
      } catch (_e) {
        // do nothing
      }
    };

    eventSource.onerror = () => {
      try {
        if (closed) {
          return;
        }

        void writer.close();
      } catch (_e) {
        return;
      }
    };
  });

  return new Response(responseStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}
