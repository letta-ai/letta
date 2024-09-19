import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { ChatWithAgentParamsSchema } from '$letta/pdk/contracts/agents';
import { ChatWithAgentBodySchema } from '$letta/pdk/contracts/agents';
import type { z } from 'zod';
import { verifyAndReturnAPIKeyDetails } from '$letta/server/auth';
import { db, deployedAgents } from '@letta-web/database';
import { and, eq } from 'drizzle-orm';
import { EventSource } from 'extended-eventsource';
import { environment } from '@letta-web/environmental-variables';
import { AgentsService } from '@letta-web/letta-agents-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Context {
  params: z.infer<typeof ChatWithAgentParamsSchema>;
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
    return new Response('Agent not found', { status: 404 });
  }

  const { message, stream } = body.data;

  const deployedAgentId = context.params.deployedAgentId;
  const organizationId = keyDetails.organizationId;

  if (deployedAgentId === ':deployedAgentId') {
    return new Response(
      'You seem to have left :deployedAgentId in the url path instead of specifying an agent Id.',
      { status: 400 }
    );
  }

  const deployedAgent = await db.query.deployedAgents.findFirst({
    where: and(
      eq(deployedAgents.organizationId, organizationId),
      eq(deployedAgents.id, deployedAgentId)
    ),
  });

  if (!deployedAgent) {
    return new Response('Agent not found', { status: 404 });
  }

  if (!stream) {
    const response = await AgentsService.createAgentMessage({
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
    const eventsource = new EventSource(
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

    eventsource.onmessage = (e: MessageEvent) => {
      if (closed) {
        return;
      }

      if (e.eventPhase === eventsource.CLOSED) {
        closed = true;
        void responseStream.writable.close();
        void writer.close();
        return;
      }

      void writer.write(`data: ${e.data}\n\n`);
    };

    eventsource.onerror = () => {
      if (closed) {
        return;
      }

      void writer.close();
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
