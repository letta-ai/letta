# Stateful vs Stateless: Why Letta is Different

**Location:** Add to `fern/pages/concepts/letta.mdx` early in the document

**What it shows:** The fundamental difference between Letta's stateful agents and traditional stateless LLM APIs.

## Diagram Code

```mermaid
graph TB
    subgraph Traditional["❌ Traditional Stateless API (e.g., ChatCompletions)"]
        direction TB

        U1[User/App]
        API1[LLM API]

        U1 -->|"Request 1:<br/>[msg1]"| API1
        API1 -->|Response 1| U1

        U1 -->|"Request 2:<br/>[msg1, response1, msg2]"| API1
        API1 -->|Response 2| U1

        U1 -->|"Request 3:<br/>[msg1, res1, msg2, res2, msg3]"| API1
        API1 -->|Response 3| U1

        Note1[❌ Client manages state<br/>❌ No memory persistence<br/>❌ Conversation grows linearly<br/>❌ Context window fills quickly]

        style Note1 fill:#ffebee,stroke:#c62828
    end

    subgraph Letta["✅ Letta Stateful Agents"]
        direction TB

        U2[User/App]
        LETTA[Letta Server]
        DB[(Database)]

        U2 -->|"Request 1:<br/>[msg1]"| LETTA
        LETTA -->|Save state| DB
        LETTA -->|Response 1| U2

        U2 -->|"Request 2:<br/>[msg2] only!"| LETTA
        DB -->|Load state| LETTA
        LETTA -->|Update state| DB
        LETTA -->|Response 2| U2

        U2 -->|"Request 3:<br/>[msg3] only!"| LETTA
        DB -->|Load state| LETTA
        LETTA -->|Update state| DB
        LETTA -->|Response 3| U2

        Note2[✅ Server manages state<br/>✅ Persistent memory<br/>✅ Send only new messages<br/>✅ Intelligent context mgmt]

        style Note2 fill:#e8f5e9,stroke:#2e7d32
    end
```

## Alternative: Side-by-Side Comparison

```mermaid
graph LR
    subgraph Stateless["Stateless (OpenAI/Anthropic)"]
        direction TB
        C1[Client] -->|Full history every time| S1[API]
        S1 -->|Response| C1
        S1 -.->|No memory| VOID[ ]
        style VOID fill:none,stroke:none
    end

    subgraph Stateful["Stateful (Letta)"]
        direction TB
        C2[Client] -->|New message only| S2[Agent]
        S2 -->|Response| C2
        S2 <-->|Persistent state| DB[(Memory)]
    end

    style Stateless fill:#ffebee
    style Stateful fill:#e8f5e9
```

## Comparison Table

```markdown
## Key Differences

| Aspect | Traditional (Stateless) | Letta (Stateful) |
|--------|------------------------|------------------|
| **State management** | Client-side | Server-side |
| **Request format** | Send full conversation history | Send only new messages |
| **Memory** | None (ephemeral) | Persistent database |
| **Context limit** | Hard limit, then fails | Intelligent management |
| **Agent identity** | None | Each agent has unique ID |
| **Long conversations** | Expensive & brittle | Scales infinitely |
| **Personalization** | App must manage | Built-in memory blocks |
| **Multi-session** | Requires external DB | Native support |

## Code Comparison

### Stateless API (e.g., OpenAI)

```python
# You must send the entire conversation every time
messages = [
    {"role": "user", "content": "Hello, I'm Sarah"},
    {"role": "assistant", "content": "Hi Sarah!"},
    {"role": "user", "content": "What's my name?"},  # ← New message
]

# Send everything
response = openai.chat.completions.create(
    model="gpt-4",
    messages=messages  # ← Full history required
)

# You must store and manage messages yourself
messages.append(response.choices[0].message)
```

### Stateful API (Letta)

```python
# Agent already knows context
response = client.agents.messages.create(
    agent_id=agent.id,
    messages=[
        {"role": "user", "content": "What's my name?"}  # ← New message only
    ]
)

# Agent remembers Sarah from its memory blocks
# No need to send previous messages
```

## Explanation Text

> **Why stateful matters:**
>
> **Traditional LLM APIs are stateless** - like hitting "clear chat" after every message. Your application must:
> - Store all messages in a database
> - Send the entire conversation history with each request
> - Manage context window overflow manually
> - Implement memory/personalization logic
> - Handle session management
>
> **Letta agents are stateful services** - like persistent processes. The server:
> - Stores all agent state in its database
> - Accepts only new messages (not full history)
> - Manages context window intelligently
> - Provides built-in memory via editable blocks
> - Maintains agent identity across sessions
>
> **The result:** Instead of building a stateful layer on top of a stateless API, you get statefulness as a primitive.

## Usage Notes

This diagram should appear VERY early in the documentation, ideally:
1. On the main overview page
2. In the concepts/letta.mdx page
3. Referenced in the quickstart

It's the "aha moment" diagram that explains why Letta exists.