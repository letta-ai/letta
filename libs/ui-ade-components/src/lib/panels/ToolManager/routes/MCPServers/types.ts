import type {
  MCPServerType,
  MCPServerItemType,
  SSEServerConfig,
  StreamableHTTPServerConfig,
} from '@letta-cloud/sdk-core';
export type { MCPServerType };

export const MCPServerTypes = {
  Stdio: 'stdio',
  Sse: 'sse',
  StreamableHttp: 'streamable_http',
} as const;

export function toMCPServerTypeLabel(type: MCPServerType | undefined): string {
  if (type === MCPServerTypes.Stdio) {
    return 'stdio';
  }
  if (type === MCPServerTypes.Sse) {
    return 'SSE';
  }
  if (type === MCPServerTypes.StreamableHttp) {
    return 'Streamable HTTP';
  }
  return '';
}

export function getIsStreamableOrHttpServer(
  server: MCPServerItemType,
): server is SSEServerConfig | StreamableHTTPServerConfig {
  return (
    server.type === MCPServerTypes.Sse ||
    server.type === MCPServerTypes.StreamableHttp
  );
}
