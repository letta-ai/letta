# TS Server

Skeleton typescript app to support user-defined tool call function. Runs inside Modal container.

## Overview

- `server.ts` - node process listening on a unix socket
- `entrypoint.ts` - light function that deserializes JSON encoded input string to inputs into user defined function
- `user-function.ts` - fully defined by the user

## Instructions

1. `npm install`
2. `npm run build`
3. `npm run start` to start the server
