#!/usr/bin/env tsx
/* eslint-disable @typescript-eslint/no-non-null-assertion */

/**
 * Minimal TypeScript examples showing Letta's streaming API.
 * Demonstrates both step streaming (default) and token streaming modes.
 */

import { LettaClient } from '@letta-ai/letta-client';
import type { LettaMessage } from '@letta-ai/letta-client/api/types';

async function stepStreamingExample(client: LettaClient, agentId: string): Promise<void> {
    console.log('\nStep Streaming (complete messages):');

    // Send a message with step streaming (default)
    const stream = await client.agents.messages.createStream(
        agentId, {
            messages: [{role: "user", content: "Hi! My name is Alice. What's 2+2?"}]
        }
    );

    for await (const chunk of stream as AsyncIterable<LettaMessage>) {
        // Each chunk is a complete message
        if (chunk.messageType === 'assistant_message') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
            console.log((chunk as any).content);
        }
    }
}

async function tokenStreamingExample(client: LettaClient, agentId: string): Promise<void> {
    console.log('\nToken Streaming (real-time chunks):');

    // Send a message with token streaming enabled
    const stream = await client.agents.messages.createStream(
        agentId, {
            messages: [{role: "user", content: "What's my name? And tell me a short joke."}],
            streamTokens: true  // Enable token streaming
        }
    );

    // Track messages by ID for reassembly
    const messageAccumulators = new Map<string, string>();

    for await (const chunk of stream as AsyncIterable<LettaMessage>) {
        if (chunk.id && chunk.messageType === 'assistant_message') {
            const msgId = chunk.id;

            // Initialize accumulator for new messages
            if (!messageAccumulators.has(msgId)) {
                messageAccumulators.set(msgId, '');
            }

            // Accumulate and print content
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const contentChunk = (chunk as any).content || '';
            messageAccumulators.set(msgId, messageAccumulators.get(msgId)! + contentChunk);
            process.stdout.write(contentChunk);
        }
    }

    console.log(); // New line after streaming completes
}

async function main(): Promise<void> {
    // Check for API key
    const apiKey = process.env.LETTA_API_KEY;
    if (!apiKey) {
        console.error('Please set LETTA_API_KEY environment variable');
        process.exit(1);
    }

    // Initialize client
    const client = new LettaClient({ token: apiKey });

    // Create a test agent
    const agent = await client.agents.create({
        model: "openai/gpt-4o-mini",
        embedding: "openai/text-embedding-3-small",
        memoryBlocks: [
            {
                label: "human",
                value: "The user is exploring streaming capabilities."
            },
            {
                label: "persona",
                value: "I am a helpful assistant demonstrating streaming responses."
            }
        ]
    });

    try {
        // Example 1: Step Streaming (default)
        await stepStreamingExample(client, agent.id);

        // Example 2: Token Streaming
        await tokenStreamingExample(client, agent.id);

    } finally {
        // Clean up
        await client.agents.delete(agent.id);
    }
}

// Run the example
main().catch(console.error);
