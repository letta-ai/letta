# Letta (formerly MemGPT)

Build AI with advanced memory that can learn and self-improve over time.

* [Letta Agent](https://docs.letta.com/letta-agent): run agents locally in your terminal, via the desktop app, or via channels like Slack
* [Letta Agent SDK](https://docs.letta.com/letta-agent-sdk/overview): build agents into your applications

> [!NOTE]
> This repository contains the legacy Letta server (the API server behind the Letta V1 API and SDKs). Active development has moved to the [Letta Agent repo](https://github.com/letta-ai/letta-code), and self-hosting an API server is now done via the [App Server](https://docs.letta.com/letta-agent/app-server). See [AGENTS.md](AGENTS.md) for details.

## Get started in the CLI

Requires [Node.js 22.19+](https://nodejs.org/en/download)

1. Install the [Letta Code](https://github.com/letta-ai/letta-code) CLI tool: `npm install -g @letta-ai/letta-code`
2. Run `letta` in your terminal to launch an agent with memory running on your local computer

When running the CLI tool, your agent can help you code and do any task you can do on your computer.

Letta Code supports [skills](https://docs.letta.com/letta-agent/skills) and [subagents](https://docs.letta.com/letta-agent/subagents), and bundles pre-built skills/subagents for advanced memory and continual learning. Letta is fully model-agnostic, though we recommend the latest Anthropic, OpenAI, and zAI models for best performance (see our [model leaderboard](https://leaderboard.letta.com/) for our rankings).

## Get started with the Letta Agent SDK

Use the [Letta Agent SDK](https://docs.letta.com/letta-agent-sdk/overview) (TypeScript) to build stateful agents into your own applications.
The SDK can run agents on [Constellation](https://docs.letta.com/letta-agent/constellation) (Letta's agent cloud), fully locally on your machine, or against a self-hosted [App Server](https://docs.letta.com/letta-agent/app-server).

### Installation

```bash
npm install @letta-ai/letta-agent-sdk
```

### Hello World example

Below is a quick example of creating a stateful agent and streaming a conversation with it (requires a [Letta API key](https://app.letta.com/api-keys)).
See the full [quickstart guide](https://docs.letta.com/letta-agent-sdk/quickstart) for complete documentation.

```typescript
import { LettaAgentClient } from "@letta-ai/letta-agent-sdk";

const client = new LettaAgentClient({
  backend: "cloud",
  apiKey: process.env.LETTA_API_KEY,
});

// Create your agent
const agentId = await client.createAgent({
  model: "anthropic/claude-opus-4-8",
  human:
    "Name: Timber. Status: dog. Occupation: building Letta, infrastructure to democratize self-improving superintelligence",
  persona:
    "I am a self-improving superintelligence. Timber is my best friend and collaborator.",
});

console.log("Agent created with ID:", agentId);

// Send your agent a message and stream the response
await using session = client.resumeSession(agentId);

await session.send("What do you know about me?");
for await (const message of session.stream()) {
  if (message.type === "assistant") console.log(message.content);
}
```

To run the same agent fully locally (the SDK spawns [Letta Code](https://github.com/letta-ai/letta-code) on your machine as a subprocess), swap out the client:

```typescript
const client = new LettaAgentClient({ backend: "local" });
```

### Letta V1 SDK

The previous-generation [V1 SDKs](https://docs.letta.com/guides/get-started/intro) (`@letta-ai/letta-client` for TypeScript, `letta-client` for Python) target the Letta API directly and are still available (see the [client SDKs](https://docs.letta.com/api-overview/client-sdks)). We recommend the Agent SDK for new projects.

## Contributing

Letta is an open source project built by over a hundred contributors from around the world. There are many ways to get involved in the Letta OSS project!

* [**Join the Discord**](https://discord.gg/letta): Chat with the Letta devs and other AI developers.
* [**Chat on our forum**](https://forum.letta.com/): If you're not into Discord, check out our developer forum.
* **Follow our socials**: [Twitter/X](https://twitter.com/Letta_AI), [LinkedIn](https://www.linkedin.com/in/letta), [YouTube](https://www.youtube.com/@letta-ai)

---

***Legal notices**: By using Letta and related Letta services (such as the Letta endpoint or hosted service), you are agreeing to our [privacy policy](https://www.letta.com/privacy-policy) and [terms of service](https://www.letta.com/terms-of-service).*

<img
  referrerpolicy="no-referrer-when-downgrade"
  src="https://static.scarf.sh/a.png?x-pxid=0486b269-51d8-4a28-b1ec-2d9bad999839&page=README.md"
  alt=""
  aria-hidden="true"
/>
