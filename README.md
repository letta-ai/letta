<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/letta-ai/letta/refs/heads/main/assets/Letta-logo-RGB_GreyonTransparent_cropped_small.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/letta-ai/letta/refs/heads/main/assets/Letta-logo-RGB_OffBlackonTransparent_cropped_small.png">
    <img alt="Letta logo" src="https://raw.githubusercontent.com/letta-ai/letta/refs/heads/main/assets/Letta-logo-RGB_GreyonOffBlack_cropped_small.png" width="500">
  </picture>
</p>

# Letta (formerly MemGPT)

Letta is the platform for building stateful agents: open AI with advanced memory that can learn and self-improve over time.

### Quicklinks:
* [**Developer Documentation**](https://docs.letta.com): Learn how create agents that learn using Python / TypeScript
* [**Agent Development Environment (ADE)**](https://docs.letta.com/guides/ade/overview): A no-code UI for building stateful agents
* [**Letta Desktop**](https://docs.letta.com/guides/ade/desktop): A fully-local version of the ADE, available on MacOS and Windows
* [**Letta Cloud**](https://app.letta.com/): The fastest way to try Letta, with agents running in the cloud


## Get started

### [One-Shot ✨ Vibecoding ⚡️ Prompts](https://github.com/letta-ai/letta/blob/main/fern/pages/getting-started/prompts.mdx)

Or install the Letta SDK (available for both Python and TypeScript):

### [Python SDK](https://github.com/letta-ai/letta-python)
```sh
pip install letta-client
```

### [TypeScript / Node.js SDK](https://github.com/letta-ai/letta-node)
```sh
npm install @letta-ai/letta-client
```

## Simple Hello World example

In the example below, we'll create a stateful agent with two memory blocks, one for itself (the `persona` block), and one for the human. We'll initialize the `human` memory block with incorrect information, and correct agent in our first message - which will trigger the agent to update its own memory with a tool call.

*To run the examples, you'll need to get a `LETTA_API_KEY` from [Letta Cloud](https://app.letta.com/api-keys), or run your own self-hosted server (see [our guide](https://docs.letta.com/guides/selfhosting))*


### Python
```python
from letta_client import Letta
import os

# Connect to Letta Cloud (get your API key at https://app.letta.com/api-keys)
client = Letta(token=os.getenv("LETTA_API_KEY"))
# client = Letta(base_url="http://localhost:8283", embedding="openai/text-embedding-3-small")  # if self-hosting, set base_url and embedding

agent_state = client.agents.create(
    model="openai/gpt-4.1",
    memory_blocks=[
        {
          "label": "human",
          "value": "The human's name is Chad. They like vibe coding."
        },
        {
          "label": "persona",
          "value": "My name is Sam, a helpful assistant."
        }
    ],
    tools=["web_search", "run_code"]
)

print(agent_state.id)
# agent-d9be...0846

response = client.agents.messages.create(
    agent_id=agent_state.id,
    messages=[
        {
            "role": "user",
            "content": "Hey, nice to meet you, my name is Brad."
        }
    ]
)

# the agent will think, then edit its memory using a tool
for message in response.messages:
    print(message)
```

### TypeScript / Node.js
```typescript
import { LettaClient } from '@letta-ai/letta-client'

// Connect to Letta Cloud (get your API key at https://app.letta.com/api-keys)
const client = new LettaClient({ token: process.env.LETTA_API_KEY });
// const client = new LettaClient({ baseUrl: "http://localhost:8283", embedding: "openai/text-embedding-3-small" });  // if self-hosting

const agentState = await client.agents.create({
    model: "openai/gpt-4.1",
    memoryBlocks: [
        {
          label: "human",
          value: "The human's name is Chad. They like vibe coding."
        },
        {
          label: "persona",
          value: "My name is Sam, a helpful assistant."
        }
    ],
    tools: ["web_search", "run_code"]
});

console.log(agentState.id);
// agent-d9be...0846

const response = await client.agents.messages.create(
    agentState.id, {
        messages: [
            {
                role: "user",
                content: "Hey, nice to meet you, my name is Brad."
            }
        ]
    }
);

// the agent will think, then edit its memory using a tool
for (const message of response.messages) {
    console.log(message);
}
```

## Core concepts in Letta:

Letta is made by the creators of [MemGPT](https://arxiv.org/abs/2310.08560), a research paper that introduced the concept of the "LLM Operating System" for memory management. The core concepts in Letta for designing stateful agents follow the MemGPT LLM OS principles:

1. [**Memory Hierarchy**](https://docs.letta.com/guides/agents/memory): Agents have self-editing memory that is split between in-context memory and out-of-context memory
2. [**Memory Blocks**](https://docs.letta.com/guides/agents/memory-blocks): The agent's in-context memory is composed of persistent editable **memory blocks**
3. [**Agentic Context Engineering**](https://docs.letta.com/guides/agents/context-engineering): Agents control the context window by using tools to edit, delete, or search for memory
4. [**Perpetual Self-Improving Agents**](https://docs.letta.com/guides/agents/overview): Every "agent" is a single entity that has a perpetual (infinite) message history

## Multi-agent shared memory ([full guide](https://docs.letta.com/guides/agents/multi-agent-shared-memory))

A single memory block can be attached to multiple agents, allowing to extremely powerful multi-agent shared memory setups.
For example, you can create two agents that have their own independent memory blocks in addition to a shared memory block.

### Python
```python
# create a shared memory block
shared_block = client.blocks.create(
    label="organization",
    description="Shared information between all agents within the organization.",
    value="Nothing here yet, we should update this over time."
)

# create a supervisor agent
supervisor_agent = client.agents.create(
    model="anthropic/claude-3-5-sonnet-20241022",
    # blocks created for this agent
    memory_blocks=[{"label": "persona", "value": "I am a supervisor"}],
    # pre-existing shared block that is "attached" to this agent
    block_ids=[shared_block.id],
)

# create a worker agent
worker_agent = client.agents.create(
    model="openai/gpt-4.1-mini",
    # blocks created for this agent
    memory_blocks=[{"label": "persona", "value": "I am a worker"}],
    # pre-existing shared block that is "attached" to this agent
    block_ids=[shared_block.id],
)
```

### TypeScript / Node.js
```typescript
// create a shared memory block
const sharedBlock = await client.blocks.create({
    label: "organization",
    description: "Shared information between all agents within the organization.",
    value: "Nothing here yet, we should update this over time."
});

// create a supervisor agent
const supervisorAgent = await client.agents.create({
    model: "anthropic/claude-3-5-sonnet-20241022",
    // blocks created for this agent
    memoryBlocks: [{ label: "persona", value: "I am a supervisor" }],
    // pre-existing shared block that is "attached" to this agent
    blockIds: [sharedBlock.id]
});

// create a worker agent
const workerAgent = await client.agents.create({
    model: "openai/gpt-4.1-mini",
    // blocks created for this agent
    memoryBlocks: [{ label: "persona", value: "I am a worker" }],
    // pre-existing shared block that is "attached" to this agent
    blockIds: [sharedBlock.id]
});
```

## Sleep-time agents ([full guide](https://docs.letta.com/guides/agents/architectures/sleeptime))

In Letta, you can create special **sleep-time agents** that share the memory of your primary agents, but run in the background (like an agent's "subconcious"). You can think of sleep-time agents as a special form of multi-agent architecture.

To enable sleep-time agents for your agent, set the `enable_sleeptime` flag to true when creating your agent. This will automatically create a sleep-time agent in addition to your main agent which will handle the memory editing, instead of your primary agent.

### Python
```python
agent_state = client.agents.create(
    ...
    enable_sleeptime=True,  # <- enable this flag to create a sleep-time agent
)
```

### TypeScript / Node.js
```typescript
const agentState = await client.agents.create({
    ...
    enableSleeptime: true  // <- enable this flag to create a sleep-time agent
});
```

## Saving and sharing agents with Agent File (`.af`) ([full guide](https://docs.letta.com/guides/agents/agent-file))

In Letta, all agent data is persisted to disk (Postgres or SQLite), and can be easily imported and exported using the open source [Agent File](https://github.com/letta-ai/agent-file) (`.af`) file format. You can use Agent File to checkpoint your agents, as well as move your agents (and their complete state/memories) between different Letta servers, e.g. between self-hosted Letta and Letta Cloud.

<details>
<summary>View code snippets</summary>

### Python
```python
# Import your .af file from any location
agent_state = client.agents.import_agent_serialized(file=open("/path/to/agent/file.af", "rb"))

print(f"Imported agent: {agent.id}")

# Export your agent into a serialized schema object (which you can write to a file)
schema = client.agents.export_agent_serialized(agent_id="<AGENT_ID>")
```

### TypeScript / Node.js
```typescript
import { readFileSync } from 'fs';
import { Blob } from 'buffer';

// Import your .af file from any location
const file = new Blob([readFileSync('/path/to/agent/file.af')])
const agentState = await client.agents.importAgentSerialized(file, {})

console.log(`Imported agent: ${agentState.id}`);

// Export your agent into a serialized schema object (which you can write to a file)
const schema = await client.agents.exportAgentSerialized("<AGENT_ID>");
```
</details>

## Model Context Protocol (MCP) and custom tools ([full guide](https://docs.letta.com/guides/mcp/overview))

Letta has rich support for MCP tools (Letta acts as an MCP client), as well as custom Python tools.
MCP servers can be easily added within the Agent Development Environment (ADE) tool manager UI, as well as via the SDK:


<details>
<summary>View code snippets</summary>

### Python
```python
# List tools from an MCP server
tools = client.tools.list_mcp_tools_by_server(mcp_server_name="weather-server")

# Add a specific tool from the MCP server
tool = client.tools.add_mcp_tool(
    mcp_server_name="weather-server",
    mcp_tool_name="get_weather"
)

# Create agent with MCP tool attached
agent_state = client.agents.create(
    model="openai/gpt-4o-mini",
    tool_ids=[tool.id]
)

# Or attach tools to an existing agent
client.agents.tool.attach(
    agent_id=agent_state.id
    tool_id=tool.id
)

# Use the agent with MCP tools
response = client.agents.messages.create(
    agent_id=agent_state.id,
    messages=[
        {
            "role": "user",
            "content": "Use the weather tool to check the forecast"
        }
    ]
)
```

### TypeScript / Node.js
```typescript
// List tools from an MCP server
const tools = await client.tools.listMcpToolsByServer("weather-server");

// Add a specific tool from the MCP server
const tool = await client.tools.addMcpTool("weather-server", "get_weather");

// Create agent with MCP tool
const agentState = await client.agents.create({
    model: "openai/gpt-4o-mini",
    toolIds: [tool.id]
});

// Use the agent with MCP tools
const response = await client.agents.messages.create(agentState.id, {
    messages: [
        {
            role: "user",
            content: "Use the weather tool to check the forecast"
        }
    ]
});
```
</details>

## Filesystem ([full guide](https://docs.letta.com/guides/agents/filesystem))

Letta’s filesystem allow you to easily connect your agents to external files, for example: research papers, reports, medical records, or any other data in common text formats (`.pdf`, `.txt`, `.md`, `.json`, etc).
Once you attach a folder to an agent, the agent will be able to use filesystem tools (`open_file`, `grep_file`, `search_file`) to browse the files to search for information.

<details>
<summary>View code snippets</summary>

### Python
```python
# create the folder (embeddings managed automatically by Letta Cloud)
folder = client.folders.create(
    name="my_folder"
)

# upload a file into the folder
job = client.folders.files.upload(
    folder_id=folder.id,
    file=open("my_file.txt", "rb")
)

# wait until the job is completed
while True:
    job = client.jobs.retrieve(job.id)
    if job.status == "completed":
        break
    elif job.status == "failed":
        raise ValueError(f"Job failed: {job.metadata}")
    print(f"Job status: {job.status}")
    time.sleep(1)

# once you attach a folder to an agent, the agent can see all files in it
client.agents.folders.attach(agent_id=agent.id, folder_id=folder.id)

response = client.agents.messages.create(
    agent_id=agent_state.id,
    messages=[
        {
            "role": "user",
            "content": "What data is inside of my_file.txt?"
        }
    ]
)

for message in response.messages:
    print(message)
```

### TypeScript / Node.js
```typescript
// create the folder (embeddings managed automatically by Letta Cloud)
const folder = await client.folders.create({
    name: "my_folder"
});

// upload a file into the folder
const uploadJob = await client.folders.files.upload(
    createReadStream("my_file.txt"),
    folder.id,
);
console.log("file uploaded")

// wait until the job is completed
while (true) {
    const job = await client.jobs.retrieve(uploadJob.id);
    if (job.status === "completed") {
        break;
    } else if (job.status === "failed") {
        throw new Error(`Job failed: ${job.metadata}`);
    }
    console.log(`Job status: ${job.status}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
}

// list files in the folder
const files = await client.folders.files.list(folder.id);
console.log(`Files in folder: ${files}`);

// list passages in the folder
const passages = await client.folders.passages.list(folder.id);
console.log(`Passages in folder: ${passages}`);

// once you attach a folder to an agent, the agent can see all files in it
await client.agents.folders.attach(agent.id, folder.id);

const response = await client.agents.messages.create(
    agentState.id, {
        messages: [
            {
                role: "user",
                content: "What data is inside of my_file.txt?"
            }
        ]
    }
);

for (const message of response.messages) {
    console.log(message);
}
```
</details>

## Long-running agents ([full guide](https://docs.letta.com/guides/agents/long-running))

When agents need to execute multiple tool calls or perform complex operations (like deep research, data analysis, or multi-step workflows), processing time can vary significantly. Letta supports both a background mode (with resumable streaming) as well as an async mode (with polling) to enable robust long-running agent executions.


<details>
<summary>View code snippets</summary>

### Python
```python
stream = client.agents.messages.create_stream(
    agent_id=agent_state.id,
    messages=[
      {
        "role": "user",
        "content": "Run comprehensive analysis on this dataset"
      }
    ],
    stream_tokens=True,
    background=True,
)
run_id = None
last_seq_id = None
for chunk in stream:
    if hasattr(chunk, "run_id") and hasattr(chunk, "seq_id"):
        run_id = chunk.run_id       # Save this to reconnect if your connection drops
        last_seq_id = chunk.seq_id  # Save this as your resumption point for cursor-based pagination
    print(chunk)

# If disconnected, resume from last received seq_id:
for chunk in client.runs.stream(run_id, starting_after=last_seq_id):
    print(chunk)
```

### TypeScript / Node.js
```typescript
const stream = await client.agents.messages.createStream({
    agentId: agentState.id,
    requestBody: {
        messages: [
            {
                role: "user",
                content: "Run comprehensive analysis on this dataset"
            }
        ],
        streamTokens: true,
        background: true,
    }
});

let runId = null;
let lastSeqId = null;
for await (const chunk of stream) {
    if (chunk.run_id && chunk.seq_id) {
        runId = chunk.run_id;      // Save this to reconnect if your connection drops
        lastSeqId = chunk.seq_id; // Save this as your resumption point for cursor-based pagination
    }
    console.log(chunk);
}

// If disconnected, resume from last received seq_id
for await (const chunk of client.runs.stream(runId, {startingAfter: lastSeqId})) {
    console.log(chunk);
}
```
</details>

## Using local models

Letta is model agnostic and supports using local model providers such as [Ollama](https://docs.letta.com/guides/server/providers/ollama) and [LM Studio](https://docs.letta.com/guides/server/providers/lmstudio). You can also easily swap models inside an agent after the agent has been created, by modifying the agent state with the new model provider via the SDK or in the ADE.

## Development (only needed if you need to modify the server code)

*Note: this repostory contains the source code for the core Letta service (API server), not the client SDKs. The client SDKs can be found here: [Python](https://github.com/letta-ai/letta-python), [TypeScript](https://github.com/letta-ai/letta-node).*

To install the Letta server from source, fork the repo, clone your fork, then use [uv](https://docs.astral.sh/uv/getting-started/installation/) to install from inside the main directory:
```sh
cd letta
uv sync --all-extras
```

To run the Letta server from source, use `uv run`:
```sh
uv run letta server
```

## Contributing

Letta is an open source project built by over a hundred contributors. There are many ways to get involved in the Letta OSS project!

* [**Join the Discord**](https://discord.gg/letta): Chat with the Letta devs and other AI developers.
* [**Chat on our forum**](https://forum.letta.com/): If you're not into Discord, check out our developer forum.
* **Follow our socials**: [Twitter/X](https://twitter.com/Letta_AI), [LinkedIn](https://www.linkedin.com/in/letta), [YouTube](https://www.youtube.com/@letta-ai)

---

***Legal notices**: By using Letta and related Letta services (such as the Letta endpoint or hosted service), you are agreeing to our [privacy policy](https://www.letta.com/privacy-policy) and [terms of service](https://www.letta.com/terms-of-service).*
