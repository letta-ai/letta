<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/letta-ai/letta/refs/heads/main/assets/Letta-logo-RGB_GreyonTransparent_cropped_small.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/letta-ai/letta/refs/heads/main/assets/Letta-logo-RGB_OffBlackonTransparent_cropped_small.png">
    <img alt="Letta logo" src="https://raw.githubusercontent.com/letta-ai/letta/refs/heads/main/assets/Letta-logo-RGB_GreyonOffBlack_cropped_small.png" width="500">
  </picture>
</p>

# Letta (formerly MemGPT)

Letta is the platform for building stateful agents: AI with advanced memory that can learn and self-improve over time.

* [Letta Code](https://docs.letta.com/letta-code): run agents locally in your terminal
* [Letta API](https://docs.letta.com/quickstart/): build agents into your applications

## Get started in the CLI

Requires [Node.js 18+](https://nodejs.org/en/download)

1. Install the [Letta Code](https://github.com/letta-ai/letta-code) CLI tool: `npm install -g @letta-ai/letta-code`
2. Run `letta` in your terminal to launch an agent with memory running on your local computer

When running the CLI tool, your agent help you code and do any task you can do on your computer.

Letta Code supports [skills](https://docs.letta.com/letta-code/skills) and [subagents](https://docs.letta.com/letta-code/subagents), and bundles pre-built skills/subagents for advanced memory and continual learning. Letta is fully model-agnostic, though we recommend Opus 4.5 and GPT-5.2 for best performance (see our [model leaderboard](https://leaderboard.letta.com/) for our rankings).

## Get started with the Letta API

Use the Letta API to integrate stateful agents into your own applications.
Letta has a full-featured agents API, and a Python and Typescript SDK (view our [API reference](https://docs.letta.com/api)).

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

Below is a quick example of creating a stateful agent and sending it a message (requires a [Letta API key](https://app.letta.com)).
See the full [quickstart guide](https://docs.letta.com/quickstart) for complete documentation.

TypeScript:
```typescript
import Letta from "@letta-ai/letta-client";

const client = new Letta({ apiKey: process.env.LETTA_API_KEY });

// Create your agent
const agentState = await client.agents.create({
  model: "openai/gpt-5.2",
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
  tools: ["web_search", "fetch_webpage"],
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
    model="openai/gpt-5.2",
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
    tools=["web_search", "fetch_webpage"]
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

## Using Letta as a proxy for Claude Code CLI

You can use a self-hosted Letta server as a proxy for [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code), enabling memory persistence across sessions.

### 1. Start the Letta server

```bash
docker compose -f dev-compose.yaml up --build -d
```

### 2. Configure Claude Code CLI

Set the `ANTHROPIC_BASE_URL` environment variable to point to the Letta proxy endpoint:

```bash
export ANTHROPIC_BASE_URL=http://localhost:8283/v1/anthropic
```

Or add it to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:8283/v1/anthropic"
  }
}
```

### 3. Run Claude Code CLI

```bash
claude
```

Your requests will now be proxied through Letta, enabling memory features.

## Contributing

Letta is an open source project built by over a hundred contributors from around the world. There are many ways to get involved in the Letta OSS project!

* [**Join the Discord**](https://discord.gg/letta): Chat with the Letta devs and other AI developers.
* [**Chat on our forum**](https://forum.letta.com/): If you're not into Discord, check out our developer forum.
* **Follow our socials**: [Twitter/X](https://twitter.com/Letta_AI), [LinkedIn](https://www.linkedin.com/in/letta), [YouTube](https://www.youtube.com/@letta-ai)

---

***Legal notices**: By using Letta and related Letta services (such as the Letta endpoint or hosted service), you are agreeing to our [privacy policy](https://www.letta.com/privacy-policy) and [terms of service](https://www.letta.com/terms-of-service).*
