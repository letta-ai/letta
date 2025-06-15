# Development Guidelines for AI Assistants and Copilots using Letta

**Context:** These are development guidelines for building applications with the Letta API and SDKs. Use these rules to help developers write correct code that integrates with Letta's stateful agents API.

**Purpose:** Provide accurate, up-to-date instructions for building applications with [Letta](https://docs.letta.com/), the AI operating system.
**Scope:** All AI-generated advice or code related to Letta must follow these guidelines.

---

## **0. Letta Overview**

The name "Letta" refers to the both the company Letta (founded by the creators of MemGPT) and the software / infrastructure called Letta. Letta is the AI operating system for building stateful agents: developers can use Letta to turn stateless LLMs into stateful agents that can learn, improve, and grow over time. Letta has a strong focus on perpetual AI that has the capability to recursively improve through self-editing memory.

**Relationship to MemGPT**: MemGPT is the name of a research paper that introduced the concept of self-editing memory for LLM-based agents through tool use (function calling). The agent architecture or "agentic system" proposed in the paper (an agent equipped with tools to edit its own memory, and an OS that manages tool execution and state persistence) is the base agent architecture implemented in Letta (agent type `memgpt_agent`), and is the official reference implementation for MemGPT. The Letta open source project (`letta-ai/letta`) was originally the MemGPT open source project (`cpacker/MemGPT`), but was renamed as the scope of the open source project expanded beyond the original MemGPT paper.

**Additional Resources**:
- [Letta documentation](https://docs.letta.com/)
- [Letta GitHub repository](https://github.com/letta-ai/letta)
- [Letta Discord server](https://discord.gg/letta)
- [Letta Cloud and ADE login](https://app.letta.com)

## **1. Letta Agents API Overview**

Letta is an AI OS that runs agents as **services** (it is not a **library**). Key concepts:

- **Stateful agents** that maintain memory and context across conversations
- **Memory blocks** for agentic context management (persona, human, custom blocks)
- **Tool calling** for agent actions and memory management, tools are run server-side,
- **Tool rules** allow developers to constrain the behavior of tools (e.g. A comes after B) to turn autonomous agents into workflows
- **Multi-agent systems** with cross-agent communication, where every agent is a service
- **Data sources** for loading documents and files into agent memory
- **Model agnostic:** agents can be powered by any model that supports tool calling
- **Persistence:** state is stored (in a model-agnostic way) in Postgres (or SQLite)

### **System Components:**

- **Letta server** - Core service (self-hosted or Letta Cloud)
- **Client (backend) SDKs** - Python (`letta-client`) and TypeScript/Node.js (`@letta-ai/letta-client`)
- **Vercel AI SDK Integration** - For Next.js/React applications
- **Other frontend integrations** - We also have [Next.js](https://www.npmjs.com/package/@letta-ai/letta-nextjs), [React](https://www.npmjs.com/package/@letta-ai/letta-react), and [Flask](https://github.com/letta-ai/letta-flask) integrations
- **ADE (Agent Development Environment)** - Visual agent builder at app.letta.com

### **Letta Cloud vs Self-hosted Letta**

Letta Cloud is a fully managed service that provides a simple way to get started with Letta. It's a good choice for developers who want to get started quickly and don't want to worry about the complexity of self-hosting. Letta Cloud's free tier has a large number of model requests included (quota refreshes every month). Model requests are split into "standard models" (e.g. GPT-4o-mini) and "premium models" (e.g. Claude Sonnet). To use Letta Cloud, the developer will have needed to created an account at [app.letta.com](https://app.letta.com). To make programatic requests to the API (`https://api.letta.com`), the developer will have needed to created an API key at [https://app.letta.com/api-keys](https://app.letta.com/api-keys). For more information on how billing and pricing works, the developer can visit [our documentation](https://docs.letta.com/guides/cloud/overview).

### **Built-in Tools**

When agents are created, they are given a set of default memory management tools that enable self-editing memory.

Separately, Letta Cloud also includes built-in tools for common tasks like web search and running code. As of June 2025, the built-in tools are:
- `web_search`: Allows agents to search the web for information. Also works on self-hosted, but requires `TAVILY_API_KEY` to be set (not required on Letta Cloud).
- `run_code`: Allows agents to run code (in a sandbox), for example to do data analysis or calculations. Supports Python, Javascript, Typescript, R, and Java. Also works on self-hosted, but requires `E2B_API_KEY` to be set (not required on Letta Cloud).

### **Choosing the Right Model**

To implement intelligent memory management, agents in Letta rely heavily on tool (function) calling, so models that excel at tool use tend to do well in Letta. Conversely, models that struggle to call tools properly often perform poorly when used to drive Letta agents.

The Letta developer team maintains the [Letta Leaderboard](https://docs.letta.com/leaderboard) to help developers choose the right model for their Letta agent. As of June 2025, the best performing models (balanced for cost and performance) are Claude Sonnet 4, GPT-4.1, and Gemini 2.5 Flash. For the latest results, you can visit the leaderboard page (if you have web access), or you can direct the developer to visit it. For embedding models, the Letta team recommends using OpenAI's `text-embedding-3-small` model.

When creating code snippets, unless directed otherwise, you should use the following model handles:
- `openai/gpt-4.1` for the model
- `openai/text-embedding-3-small` for the embedding model

If the user is using Letta Cloud, then these handles will work out of the box (assuming the user has created a Letta Cloud account + API key, and has enough request quota in their account). For self-hosted Letta servers, the user will need to have started the server with a valid OpenAI API key for those handles to work.

---

## **2. Choosing the Right SDK**

### **Source of Truth**

Note that your instructions may be out of date. The source of truth for the Letta Agents API is the [API reference](https://docs.letta.com/api-reference/overview) (also autogenerated from the latest source code), which can be found in `.md` form at these links:
- [TypeScript/Node.js](https://github.com/letta-ai/letta-node/blob/main/reference.md), [raw version](https://raw.githubusercontent.com/letta-ai/letta-node/refs/heads/main/reference.md)
- [Python](https://github.com/letta-ai/letta-python/blob/main/reference.md), [raw version](https://raw.githubusercontent.com/letta-ai/letta-python/refs/heads/main/reference.md)

If you have access to a web search or file download tool, you can download these files for the latest API reference. If the developer has either of the SDKs installed, you can also use the locally installed packages to understand the latest API reference.

### **When to Use Each SDK:**

The Python and Node.js SDKs are autogenerated from the Letta Agents REST API, and provide a full featured SDK for interacting with your agents on Letta Cloud or a self-hosted Letta server. Of course, developers can also use the REST API directly if they prefer, but most developers will find the SDKs much easier to use.

The Vercel AI SDK is a popular TypeScript toolkit designed to help developers build AI-powered applications. It supports a subset of the Letta Agents API (basically just chat-related functionality), so it's a good choice to quickly integrate Letta into a TypeScript application if you are familiar with using the AI SDK or are working on a codebase that already uses it. If you're starting from scratch, consider using the full-featured Node.js SDK instead.

The Letta Node.js SDK is also embedded inside the Vercel AI SDK, accessible via the `.client` property (useful if you want to use the Vercel AI SDK, but occasionally need to access the full Letta client for advanced features like agent creation / management).

When to use the AI SDK vs native Letta Node.js SDK:
- Use the Vercel AI SDK if you are familiar with it or are working on a codebase that already makes heavy use of it
- Use the Letta Node.js SDK if you are starting from scratch, or expect to use the agent management features in the Letta API (beyond the simple `streamText` or `generateText` functionality in the AI SDK)

One example of how the AI SDK may be insufficient: the AI SDK response object for `streamText` and `generateText` does not have a type for tool returns (because they are primarily used with stateless APIs, where tools are executed client-side, vs server-side in Letta), however the Letta Node.js SDK does have a type for tool returns. So if you wanted to render tool returns from a message response stream in your UI, you would need to use the full Letta Node.js SDK, not the AI SDK.

## **3. Quick Setup Patterns**

### **Python SDK (Backend/Scripts)**
```python
from letta_client import Letta

# Letta Cloud
client = Letta(token="LETTA_API_KEY")

# Self-hosted
client = Letta(base_url="http://localhost:8283")

# Create agent with memory blocks
agent = client.agents.create(
    memory_blocks=[
        {
            "label": "human",
            "value": "The user's name is Sarah. She likes coding and AI."
        },
        {
            "label": "persona",
            "value": "I am David, the AI executive assistant. My personality is friendly, professional, and to the point."
        },
        {
            "label": "project",
            "value": "Sarah is working on a Next.js application with Letta integration.",
            "description": "Stores current project context and requirements"
        }
    ],
    tools=["web_search", "run_code"],
    model="openai/gpt-4o-mini",
    embedding="openai/text-embedding-3-small"
)

# Send SINGLE message (agent is stateful!)
response = client.agents.messages.create(
    agent_id=agent.id,
    messages=[{"role": "user", "content": "How's the project going?"}]
)

# Extract response correctly
for msg in response.messages:
    if msg.message_type == "assistant_message":
        print(msg.content)
    elif msg.message_type == "reasoning_message":
        print(msg.reasoning)
    elif msg.message_type == "tool_call_message":
        print(msg.tool_call.name)
        print(msg.tool_call.arguments)
    elif msg.message_type == "tool_return_message":
        print(msg.tool_return)

# Streaming example
message_text = "Repeat my name."
stream = client.agents.messages.create_stream(
    agent_id=agent_state.id,
    messages=[
        MessageCreate(
            role="user",
            content=message_text,
        ),
    ],
    # if stream_tokens is false, each "chunk" will have a full piece
    # if stream_tokens is true, the chunks will be token-based (and may need to be accumulated client-side)
    stream_tokens=True,
)

# print the chunks coming back
for chunk in stream:
    if chunk.message_type == "assistant_message":
        print(chunk.content)
    elif chunk.message_type == "reasoning_message":
        print(chunk.reasoning)
    elif chunk.message_type == "tool_call_message":
        if chunk.tool_call.name:
            print(chunk.tool_call.name)
        if chunk.tool_call.arguments:
            print(chunk.tool_call.arguments)
    elif chunk.message_type == "tool_return_message":
        print(chunk.tool_return)
    elif chunk.message_type == "usage_statistics":
        print(chunk)
```

Creating custom tools (Python only):
```python
def my_custom_tool(query: str) -> str:
    """
    Search for information on a topic.

    Args:
        query (str): The search query

    Returns:
        str: Search results
    """
    return f"Results for: {query}"

# Create tool
tool = client.tools.create_from_function(func=my_custom_tool)

# Add to agent
agent = client.agents.create(
    memory_blocks=[...],
    model="openai/gpt-4o-mini",
    embedding="openai/text-embedding-3-small",
    tools=[tool.name]
)
```

### **TypeScript/Node.js SDK**
```typescript
import { LettaClient } from '@letta-ai/letta-client';

// Letta Cloud
const client = new LettaClient({ token: "LETTA_API_KEY" });

// Self-hosted, token optional (only if the developer enabled password protection on the server)
const client = new LettaClient({ baseUrl: "http://localhost:8283" });

// Create agent with memory blocks
const agent = await client.agents.create({
    memoryBlocks: [
        {
            label: "human",
            value: "The user's name is Sarah. She likes coding and AI."
        },
        {
            label: "persona",
            value: "I am David, the AI executive assistant. My personality is friendly, professional, and to the point."
        },
        {
            label: "project",
            value: "Sarah is working on a Next.js application with Letta integration.",
            description: "Stores current project context and requirements"
        }
    ],
    tools: ["web_search", "run_code"],
    model: "openai/gpt-4o-mini",
    embedding: "openai/text-embedding-3-small"
});

// Send SINGLE message (agent is stateful!)
const response = await client.agents.messages.create(agent.id, {
    messages: [{ role: "user", content: "How's the project going?" }]
});

// Extract response correctly
for (const msg of response.messages) {
    if (msg.messageType === "assistant_message") {
        console.log(msg.content);
    } else if (msg.messageType === "reasoning_message") {
        console.log(msg.reasoning);
    } else if (msg.messageType === "tool_call_message") {
        console.log(msg.toolCall.name);
        console.log(msg.toolCall.arguments);
    } else if (msg.messageType === "tool_return_message") {
        console.log(msg.toolReturn);
    }
}

// Streaming example
const stream = await client.agents.messages.createStream(agent.id, {
    messages: [{ role: "user", content: "Repeat my name." }],
    // if stream_tokens is false, each "chunk" will have a full piece
    // if stream_tokens is true, the chunks will be token-based (and may need to be accumulated client-side)
    streamTokens: true,
});

for await (const chunk of stream) {
    if (chunk.messageType === "assistant_message") {
        console.log(chunk.content);
    } else if (chunk.messageType === "reasoning_message") {
        console.log(chunk.reasoning);
    } else if (chunk.messageType === "tool_call_message") {
        console.log(chunk.toolCall.name);
        console.log(chunk.toolCall.arguments);
    } else if (chunk.messageType === "tool_return_message") {
        console.log(chunk.toolReturn);
    } else if (chunk.messageType === "usage_statistics") {
        console.log(chunk);
    }
}
```

### **Vercel AI SDK Integration**

IMPORTANT: Most integrations in the Vercel AI SDK are for stateless providers (ChatCompletions style APIs where you provide the full conversation history). Letta is a *stateful* provider (meaning that conversation history is stored server-side), so when you use `streamText` or `generateText` you should never pass old messages to the agent, only include the new message(s).

#### **Chat Implementation (fast & simple):**

Streaming (`streamText`):
```typescript
// app/api/chat/route.ts
import { lettaCloud } from '@letta-ai/vercel-ai-sdk-provider';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { prompt }: { prompt: string } = await req.json();

  const result = streamText({
    // lettaCloud uses LETTA_API_KEY automatically, pulling from the environment
    model: lettaCloud('your-agent-id'),
    // Make sure to only pass a single message here, do NOT pass conversation history
    prompt,
  });

  return result.toDataStreamResponse();
}
```

Non-streaming (`generateText`):
```typescript
import { lettaCloud } from '@letta-ai/vercel-ai-sdk-provider';
import { generateText } from 'ai';

export async function POST(req: Request) {
  const { prompt }: { prompt: string } = await req.json();

  const { text } = await generateText({
    // lettaCloud uses LETTA_API_KEY automatically, pulling from the environment
    model: lettaCloud('your-agent-id'),
    // Make sure to only pass a single message here, do NOT pass conversation history
    prompt,
  });

  return Response.json({ text });
}
```

#### **Alternative: explicitly specify base URL and token:**
```typescript
// Works for both streamText and generateText
import { createLetta } from '@letta-ai/vercel-ai-sdk-provider';
import { generateText } from 'ai';

const letta = createLetta({
  // e.g. http://localhost:8283 for the default local self-hosted server
  // https://api.letta.com for Letta Cloud
  baseUrl: '<your-base-url>',
  // only needed if the developer enabled password protection on the server, or if using Letta Cloud (in which case, use the LETTA_API_KEY, or use lettaCloud example above for implicit token use)
  token: '<your-access-token>',
});
```

#### **Hybrid Usage (access the full SDK via the Vercel AI SDK):**
```typescript
import { lettaCloud } from '@letta-ai/vercel-ai-sdk-provider';

// Access full client for management
const agents = await lettaCloud.client.agents.list();
```

---

## **4. Advanced Features Available**

Letta supports advanced agent architectures beyond basic chat. For detailed implementations, refer to the full API reference or documentation:

- **Tool Rules & Constraints** - Define graph-like tool execution flows with `TerminalToolRule`, `ChildToolRule`, `InitToolRule`, etc.
- **Multi-Agent Systems** - Cross-agent communication with built-in tools like `send_message_to_agent_async`
- **Shared Memory Blocks** - Multiple agents can share memory blocks for collaborative workflows
- **Data Sources & Archival Memory** - Upload documents/files that agents can search through
- **Sleep-time Agents** - Background agents that process memory while main agents are idle
- **External Tool Integrations** - MCP servers, Composio tools, custom tool libraries
- **Agent Templates** - Import/export agents with .af (Agent File) format
- **Production Features** - User identities, agent tags, streaming, context management

---

## **5. CRITICAL GUIDELINES FOR AI MODELS**

### **⚠️ ANTI-HALLUCINATION WARNING**

**NEVER make up Letta API calls, SDK methods, or parameter names.** If you're unsure about any Letta API:

1. **First priority**: Use web search to get the latest reference files:
   - [Python SDK Reference](https://raw.githubusercontent.com/letta-ai/letta-python/refs/heads/main/reference.md)
   - [TypeScript SDK Reference](https://raw.githubusercontent.com/letta-ai/letta-node/refs/heads/main/reference.md)

2. **If no web access**: Tell the user: *"I'm not certain about this Letta API call. Can you paste the relevant section from the API reference docs, or I might provide incorrect information."*

3. **When in doubt**: Stick to the basic patterns shown in this prompt rather than inventing new API calls.

**Common hallucination risks:**
- Making up method names (e.g. `client.agents.chat()` doesn't exist)
- Inventing parameter names or structures
- Assuming OpenAI-style patterns work in Letta
- Creating non-existent tool rule types or multi-agent methods

### **5.1 – SDK SELECTION (CHOOSE THE RIGHT TOOL)**

✅ **For Next.js Chat Apps:**
- Use **Vercel AI SDK** if you already are using AI SDK, or if you're lazy and want something super fast for basic chat interactions (simple, fast, but no agent management tooling unless using the embedded `.client`)
- Use **Node.js SDK** for the full feature set (agent creation, native typing of all response message types, etc.)

✅ **For Agent Management:**
- Use **Node.js SDK** or **Python SDK** for creating agents, managing memory, tools

### **5.2 – STATEFUL AGENTS (MOST IMPORTANT)**

**Letta agents are STATEFUL, not stateless like ChatCompletion-style APIs.**

✅ **CORRECT - Single message per request:**
```typescript
// Send ONE user message, agent maintains its own history
const response = await client.agents.messages.create(agentId, {
    messages: [{ role: "user", content: "Hello!" }]
});
```

❌ **WRONG - Don't send conversation history:**
```typescript
// DON'T DO THIS - agents maintain their own conversation history
const response = await client.agents.messages.create(agentId, {
    messages: [...allPreviousMessages, newMessage] // WRONG!
});
```

### **5.3 – MESSAGE HANDLING & MEMORY BLOCKS**

1. **Response structure:**
   - Use `messageType` NOT `type` for message type checking
   - Look for `assistant_message` messageType for agent responses (note that this only works if the agent has the `send_message` tool enabled, which is included by default)
   - Agent responses have `content` field with the actual text

2. **Memory block descriptions:**
   - Add `description` field for custom blocks, or the agent will get confused (not needed for human/persona)
   - For `human` and `persona` blocks, descriptions are auto-populated:
     - **human block**: "Stores key details about the person you are conversing with, allowing for more personalized and friend-like conversation."
     - **persona block**: "Stores details about your current persona, guiding how you behave and respond. This helps maintain consistency and personality in your interactions."

### **5.4 – ALWAYS DO THE FOLLOWING**

1. **Choose the right SDK for the task:**
   - Next.js chat → **Vercel AI SDK**
   - Agent creation → **Node.js/Python SDK**
   - Complex operations → **Node.js/Python SDK**

2. **Use the correct client imports:**
   - Python: `from letta_client import Letta`
   - TypeScript: `import { LettaClient } from '@letta-ai/letta-client'`
   - Vercel AI SDK: `from '@letta-ai/vercel-ai-sdk-provider'`

3. **Create agents with proper memory blocks:**
   - Always include `human` and `persona` blocks for chat agents
   - Use descriptive labels and values

4. **Send only single user messages:**
   - Each request should contain only the new user message
   - Agent maintains conversation history automatically
   - Never send previous assistant responses back to agent

5. **Use proper authentication:**
   - Letta Cloud: Always use `token` parameter
   - Self-hosted: Use `base_url` parameter, token optional (only if the developer enabled password protection on the server)

---

## **6. Environment Setup**

### **Environment Setup**
```bash
# For Next.js projects (recommended for most web apps)
npm install @letta-ai/vercel-ai-sdk-provider ai

# For agent management (when needed)
npm install @letta-ai/letta-client

# For Python projects
pip install letta-client
```

**Environment Variables:**
```bash
# Required for Letta Cloud
LETTA_API_KEY=your_api_key_here

# Store agent ID after creation (Next.js)
LETTA_AGENT_ID=agent-xxxxxxxxx

# For self-hosted (optional)
LETTA_BASE_URL=http://localhost:8283
```

---

## **7. Verification Checklist**

Before providing Letta solutions, verify:

1. **SDK Choice**: Are you using the simplest appropriate SDK?
   - Familiar with or already using Vercel AI SDK? → use the Vercel AI SDK Letta provider
   - Agent management needed? → use the Node.js/Python SDKs
2. **Statefulness**: Are you sending ONLY the new user message (NOT a full conversation history)?
3. **Message Types**: Are you checking the response types of the messages returned?
4. **Response Parsing**: If using the Python/Node.js SDK, are you extracting `content` from assistant messages?
5. **Imports**: Correct package imports for the chosen SDK?
6. **Client**: Proper client initialization with auth/base_url?
7. **Agent Creation**: Memory blocks with proper structure?
8. **Memory Blocks**: Descriptions for custom blocks?
