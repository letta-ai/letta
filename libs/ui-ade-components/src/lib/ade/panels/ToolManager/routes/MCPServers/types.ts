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

export interface MCPToolParameter {
  type?: string;
  description?: string;
  enum?: string[];
  default?: string;
}

export interface MCPToolInputSchema {
  type?: string;
  properties?: Record<string, MCPToolParameter>;
  required?: string[];
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: MCPToolInputSchema;
}

export enum OauthStreamEvent {
  CONNECTION_ATTEMPT = 'connection_attempt',
  SUCCESS = 'success',
  ERROR = 'error',
  OAUTH_REQUIRED = 'oauth_required',
  AUTHORIZATION_URL = 'authorization_url',
  WAITING_FOR_AUTH = 'waiting_for_auth',
}
