# Letta Streaming Examples

Minimal examples demonstrating Letta's streaming API in both Python and TypeScript.

## Setup

1. Set your Letta API key:
```bash
export LETTA_API_KEY="your_api_key_here"
```

2. Install dependencies:
```bash
# For TypeScript
npm install

# For Python
pip install letta-client
```

## Run Examples

### Python
```bash
python streaming_demo.py
```

### TypeScript
```bash
npm run demo:typescript
# or directly with tsx:
npx tsx streaming_demo.ts
```

## What These Examples Show

Both examples demonstrate:

1. **Step Streaming** (default) - Complete messages delivered as they're generated
2. **Token Streaming** - Partial chunks for real-time display (ChatGPT-like UX)

The key difference:
- Step streaming: Each event contains a complete message
- Token streaming: Multiple events per message, requiring reassembly by message ID

## Key Concepts

### Python
```python
# Step streaming (default)
stream = client.agents.messages.create_stream(
    agent_id=agent.id,
    messages=[{"role": "user", "content": "Hello!"}]
)

# Token streaming
stream = client.agents.messages.create_stream(
    agent_id=agent.id,
    messages=[{"role": "user", "content": "Hello!"}],
    stream_tokens=True  # Enable token streaming
)
```

### TypeScript
```typescript
// Step streaming (default)
const stream = await client.agents.messages.createStream(
    agentId, {
        messages: [{role: "user", content: "Hello!"}]
    }
);

// Token streaming
const stream = await client.agents.messages.createStream(
    agentId, {
        messages: [{role: "user", content: "Hello!"}],
        streamTokens: true  // Enable token streaming
    }
);
```

## Learn More

See the full documentation at [docs.letta.com/guides/agents/streaming](https://docs.letta.com/guides/agents/streaming)