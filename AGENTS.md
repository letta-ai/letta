# AGENTS.md

## This repository is deprecated

This repository contains the **legacy Letta server**: the self-hosted API server (`letta/letta` image) that powers the Letta V1 API and V1 SDKs (`@letta-ai/letta-client` for TypeScript, `letta-client` for Python). It is in maintenance mode and is no longer where active development happens.

If you are an agent working here, you most likely want one of these instead:

| You want to... | Go to |
| --- | --- |
| Use or modify the current Letta agent (harness, CLI, channel integrations, etc.) | [letta-ai/letta-code](https://github.com/letta-ai/letta-code) |
| Build agents into an application programmatically | [Letta Agent SDK](https://docs.letta.com/letta-agent-sdk/overview) (`@letta-ai/letta-agent-sdk`) |
| Self-host a server for Letta agents | [App Server](https://docs.letta.com/letta-agent/app-server), which replaces the API server in this repo |
| Reference the legacy V1 SDK / API | [V1 SDK docs](https://docs.letta.com/guides/get-started/intro) |

## Notes for agents working in this repo

- New features and integrations should target [letta-ai/letta-code](https://github.com/letta-ai/letta-code) and the [Letta Agent SDK](https://docs.letta.com/letta-agent-sdk/overview), not this codebase.
- All contributions (issues, PRs, discussions) must comply with the [AI usage policy](AI_POLICY.md): AI assistance must be disclosed, and a human must fully understand and review everything submitted.
