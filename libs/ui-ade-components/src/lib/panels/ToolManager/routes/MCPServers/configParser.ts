import { isObject } from 'lodash';

export interface MCPJsonServerConfig {
  command?: string;
  args?: string[];
  server_url?: string;
  serverUrl?: string;
  url?: string;
  env?: Record<string, string>;
}

export interface MCPJsonConfig {
  mcpServers?: Record<string, MCPJsonServerConfig>;
}

export interface ParsedJsonConfig {
  serverName: string;
  command?: string;
  args?: string[];
  serverUrl?: string;
  env?: Record<string, string>;
  customHeaders?: Array<{ key: string; value: string }>;
}

function extractUrlFromCommand(command: string): string | undefined {
  // Match patterns like "npx mcp-remote https://..." or "npx mcp-remote@version https://..."
  const regex = /mcp-remote(?:@[\w.-]+)?\s+(https?:\/\/[^\s]+)/;
  const match = regex.exec(command);
  return match ? match[1] : undefined;
}

function extractUrlFromArgs(args: string[]): string | undefined {
  // Find the index of mcp-remote or mcp-remote@version
  const mcpRemoteIndex = args.findIndex((arg) =>
    /^mcp-remote(?:@[\w.-]+)?$/.test(arg),
  );
  if (mcpRemoteIndex !== -1 && mcpRemoteIndex < args.length - 1) {
    // The URL should be the next argument
    const nextArg = args[mcpRemoteIndex + 1];
    if (nextArg?.startsWith('http')) {
      return nextArg;
    }
  }
  return undefined;
}

function extractCustomHeaders(
  args: string[],
  env?: Record<string, string>,
): Array<{ key: string; value: string }> | undefined {
  const headers: Array<{ key: string; value: string }> = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--header') {
      // Process all subsequent header values until we hit another flag or URL
      for (let j = i + 1; j < args.length; j++) {
        const headerValue = args[j];

        // Stop if we hit another flag or URL
        if (headerValue.startsWith('--') || headerValue.startsWith('http')) {
          break;
        }

        // Parse header in format "Key: Value"
        const colonIndex = headerValue.indexOf(':');
        if (colonIndex > 0) {
          const key = headerValue.substring(0, colonIndex).trim();
          let value = headerValue.substring(colonIndex + 1).trim();

          // Replace environment variable placeholders
          if (env) {
            value = value.replace(/\$\{(\w+)\}/g, (match, varName) => {
              return env[varName] || match;
            });
          }

          headers.push({ key, value });
        }
      }
    }
  }

  return headers.length > 0 ? headers : undefined;
}

function isRemoteServer(serverConfig: MCPJsonServerConfig): boolean {
  // Check if server has direct URL fields
  if (serverConfig.server_url || serverConfig.serverUrl || serverConfig.url) {
    return true;
  }

  // Check if command contains mcp-remote
  if (serverConfig.command?.includes('mcp-remote')) {
    return true;
  }

  // Check if args contains mcp-remote
  if (serverConfig.args?.some((arg) => /^mcp-remote(?:@[\w.-]+)?$/.test(arg))) {
    return true;
  }

  return false;
}

export function parseMCPJsonConfig(
  configJson: string,
): ParsedJsonConfig | null {
  try {
    if (!configJson) {
      return null;
    }

    let config: MCPJsonConfig;
    try {
      config = JSON.parse(configJson);
    } catch (_e) {
      return null;
    }

    if (!config.mcpServers || !isObject(config.mcpServers)) {
      return null;
    }

    // Get the first server from the config
    const serverNames = Object.keys(config.mcpServers);
    if (serverNames.length === 0) {
      return null;
    }

    const serverName = serverNames[0];
    const serverConfig = config.mcpServers[serverName];

    if (!serverConfig || !isObject(serverConfig)) {
      return null;
    }

    // Check if this is a remote server
    if (isRemoteServer(serverConfig)) {
      let serverUrl: string | undefined;
      let customHeaders: Array<{ key: string; value: string }> | undefined;

      // Try to get URL from direct fields first
      serverUrl =
        serverConfig.server_url || serverConfig.serverUrl || serverConfig.url;

      // If no direct URL, try to extract from command or args
      if (!serverUrl) {
        if (serverConfig.command) {
          serverUrl = extractUrlFromCommand(serverConfig.command);
        }
        if (!serverUrl && serverConfig.args) {
          serverUrl = extractUrlFromArgs(serverConfig.args);
        }
      }

      // Extract custom headers if args exist
      if (serverConfig.args) {
        customHeaders = extractCustomHeaders(
          serverConfig.args,
          serverConfig.env,
        );
      }

      return {
        serverName,
        serverUrl,
        command: undefined,
        args: undefined,
        env: undefined,
        customHeaders,
      };
    } else {
      // Local server - return command, args, and env as-is
      return {
        serverName,
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env,
        serverUrl: undefined,
      };
    }
  } catch (error) {
    console.warn('Failed to parse MCP config:', error);
    return null;
  }
}
