# Security Policy

## Supported projects

We accept vulnerability reports only for actively maintained Letta repositories and supported releases. Follow the security policy in the affected project's repository. The current Letta implementation lives in [`letta-ai/letta-code`](https://github.com/letta-ai/letta-code).

## Out of scope: retired Python server

This repository is a landing page, not an actively maintained server. The legacy Letta V1 Python server is retired, unsupported, and receives no fixes or security updates. It should not be used in production.

Please do not submit vulnerability reports that apply only to:

- The retired server source on the [`archive`](https://github.com/letta-ai/letta/tree/archive) branch or in this repository's historical tags and releases.
- The legacy Python server packages associated with that code.
- The retired `letta/letta` Docker images, regardless of tag.

These artifacts are outside the scope of our security reporting policy. If the same vulnerability also affects an actively maintained project, report it with steps to reproduce against a supported version of that project instead.

## Reporting a vulnerability in current Letta products

Please email support@letta.com with the affected repository or product, version or commit, a description of the vulnerability, steps to reproduce, and any relevant details. Do not open a public issue for security vulnerabilities.
