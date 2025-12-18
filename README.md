<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/letta-ai/letta/refs/heads/main/assets/Letta-logo-RGB_GreyonTransparent_cropped_small.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/letta-ai/letta/refs/heads/main/assets/Letta-logo-RGB_OffBlackonTransparent_cropped_small.png">
    <img alt="Letta logo" src="https://raw.githubusercontent.com/letta-ai/letta/refs/heads/main/assets/Letta-logo-RGB_GreyonOffBlack_cropped_small.png" width="500">
  </picture>
</p>

# Letta (formerly MemGPT)

Letta is the platform for building stateful agents: open AI with advanced memory that can learn and self-improve over time.

* [**Quickstart**](https://docs.letta.com/quickstart): Build your first stateful agent in 5 minutes using Python or TypeScript
* [**Understanding agent memory**](https://docs.letta.com/core-concepts): Learn about memory blocks, tools, and how Letta agents maintain state
* [**Examples and tutorials**](https://docs.letta.com/tutorials/): Working code examples for common use cases and agent patterns
* [**API reference**](https://docs.letta.com/api): Complete REST API and SDK documentation for Python and TypeScript

> [!TIP]
> **Letta Code** is a memory-first coding harness, built on top of the Letta API. Instead of working in independent sessions, you work with a persisted agent that learns over time and is portable across models. You can use Letta Code to interact with any Letta agent via the CLI.
> 
> Read more about how to use Letta Code on the [official docs page](https://docs.letta.com/letta-code), or on the [GitHub repo](https://github.com/letta-ai/letta-code).

## Get started with the Letta API

Use the Letta API to build stateful agents that remember, learn, and improve over time. Letta allows you to build agents on any model provider, including OpenAI, Anthropic, Google Gemini, and more.

### Installation

TypeScript / Node.js:
```bash
npm install @letta-ai/letta-client
```

Python:
```bash
pip install letta-client
```

### Hello World example

Below is a quick example of creating a stateful agent and sending it a message.
See the full [quickstart guide](https://docs.letta.com/quickstart) for complete documentation.

Running the examples require a [Letta Developer Platform](https://app.letta.com) account, or a [self-hosted Letta server](https://docs.letta.com/guides/selfhosting/).

TypeScript:
```typescript
import Letta from "@letta-ai/letta-client";

const client = new Letta({ apiKey: process.env.LETTA_API_KEY });

// Create your agent
const agentState = await client.agents.create({
  model: "openai/gpt-4.1",
  embedding: "openai/text-embedding-3-small",
  memory_blocks: [
    {
      label: "human",
      value:
        "Name: Timber. Status: dog. Occupation: building Letta, infrastructure to democratize self-improving superintelligence",
    },
    {
      label: "persona",
      value:
        "I am a self-improving superintelligence. Timber is my best friend and collaborator.",
    },
  ],
  tools: ["web_search", "run_code"],
});

console.log("Agent created with ID:", agentState.id);

// Send your agent a message
const response = await client.agents.messages.create(agentState.id, {
  input: "What do you know about me?",
});

for (const message of response.messages) {
  console.log(message);
}
```

Python:
```python
from letta_client import Letta
import os

client = Letta(api_key=os.getenv("LETTA_API_KEY"))

# Create your agent
agent_state = client.agents.create(
    model="openai/gpt-4.1",
    embedding="openai/text-embedding-3-small",
    memory_blocks=[
        {
          "label": "human",
          "value": "Name: Timber. Status: dog. Occupation: building Letta, infrastructure to democratize self-improving superintelligence"
        },
        {
          "label": "persona",
          "value": "I am a self-improving superintelligence. Timber is my best friend and collaborator."
        }
    ],
    tools=["web_search", "run_code"]
)

print(f"Agent created with ID: {agent_state.id}")

# Send your agent a message
response = client.agents.messages.create(
    agent_id=agent_state.id,
    input="What do you know about me?"
)

for message in response.messages:
    print(message)
```

## Contributing

Letta is an open source project built by over a hundred contributors from around the world. There are many ways to get involved in the Letta OSS project!

* [**Join the Discord**](https://discord.gg/letta): Chat with the Letta devs and other AI developers.
* [**Chat on our forum**](https://forum.letta.com/): If you're not into Discord, check out our developer forum.
* **Follow our socials**: [Twitter/X](https://twitter.com/Letta_AI), [LinkedIn](https://www.linkedin.com/in/letta), [YouTube](https://www.youtube.com/@letta-ai)

---

***Legal notices**: By using Letta and related Letta services (such as the Letta endpoint or hosted service), you are agreeing to our [privacy policy](https://www.letta.com/privacy-policy) and [terms of service](https://www.letta.com/terms-of-service).*
