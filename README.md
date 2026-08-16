# Letta

Build stateful agents with memory that can learn and improve over time.

Letta is actively developed. The current source code lives in [`letta-ai/letta-code`](https://github.com/letta-ai/letta-code), which includes the agent harness, interactive terminal UI, App Server, channels, and the runtime used by the desktop and web apps.

> [!NOTE]
> This repository now serves as a landing page for the Letta project. The retired Letta V1 server source is preserved on the [`archive`](https://github.com/letta-ai/letta/tree/archive) branch for historical reference.

## Get started

Install Letta from npm:

```bash
npm install -g @letta-ai/letta-code
```

Launch the interactive terminal UI:

```bash
letta
```

Run the App Server for local or self-hosted agents:

```bash
letta server
```

You can also use Letta through:

- the [desktop app](https://docs.letta.com/letta-code/desktop-app) for macOS, Windows, and Linux
- [chat.letta.com](https://chat.letta.com) in your browser, including on mobile
- [Slack, Telegram, Discord, and custom channels](https://docs.letta.com/letta-code/channels)
- the [Letta Agent SDK](https://docs.letta.com/letta-agent-sdk/overview) for building agents into TypeScript applications
- [Letta Cloud](https://github.com/letta-ai/letta-code#letta-cloud) for keeping agent memory, identity, and conversations available across computers

See the [`letta-ai/letta-code`](https://github.com/letta-ai/letta-code) README and the [Letta documentation](https://docs.letta.com) for current installation, development, and deployment instructions.

## Historical source

The [`archive`](https://github.com/letta-ai/letta/tree/archive) branch contains the retired Letta V1 API server as it existed when this repository was archived. Existing tags and releases remain available for reproducibility. That source is unsupported, receives no fixes or security updates, and should not be used in production.
