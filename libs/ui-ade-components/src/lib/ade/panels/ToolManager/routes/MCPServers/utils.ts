import { AUTH_TOKEN_BEARER_PREFIX } from './constants';
import { AuthModes, type CustomHeader } from './FormFields';
import type { MCPTool } from './types';

export function formatAuthToken(token: string | undefined): string | undefined {
  if (!token) return undefined;
  return `${AUTH_TOKEN_BEARER_PREFIX} ${token}`;
}

export function parseAuthToken(
  token: string | null | undefined,
): string | undefined {
  if (!token) return undefined;
  if (token.startsWith(AUTH_TOKEN_BEARER_PREFIX)) {
    return token.split(' ')[1];
  }
  return token;
}

interface AuthParsingResult {
  authHeaders?: Record<string, string>;
  authHeader?: string;
  authToken?: string;
  token?: string;
}

interface AuthParsingOptions {
  formatToken?: boolean;
  includeAuthHeader?: boolean;
}

interface AuthParsingInput {
  authMode: string;
  authToken?: string;
  customHeaders?: CustomHeader[];
  options?: AuthParsingOptions;
}

export function parseAuthenticationData(
  input: AuthParsingInput,
): AuthParsingResult {
  const { authMode, authToken, customHeaders, options = {} } = input;
  const { formatToken = false, includeAuthHeader = false } = options;
  const result: AuthParsingResult = {};

  if (authMode === AuthModes.API_KEY && authToken) {
    if (formatToken) {
      result.authToken = formatAuthToken(authToken);
      if (includeAuthHeader) {
        result.authHeader = 'Authorization';
      }
    } else {
      result.token = authToken.trim();
    }
  } else if (authMode === AuthModes.CUSTOM_HEADERS && customHeaders) {
    // Convert array of headers to object
    result.authHeaders = customHeaders
      .filter((h: CustomHeader) => h.key && h.value)
      .reduce((acc: Record<string, string>, header: CustomHeader) => {
        acc[header.key.trim()] = header.value.trim();
        return acc;
      }, {});
  }

  return result;
}

interface AuthModeAndValues {
  authMode: AuthModes;
  authToken: string;
  customHeaders: CustomHeader[];
}

export function getAuthModeAndValuesFromServer(server: {
  custom_headers?: Record<string, string> | null;
  auth_token?: string | null;
}): AuthModeAndValues {
  if (server.custom_headers && Object.keys(server.custom_headers).length > 0) {
    // Convert object headers to array format
    const headers = Object.entries(server.custom_headers).map(
      ([key, value]) => ({ key, value }),
    );
    return {
      authMode: AuthModes.CUSTOM_HEADERS,
      authToken: '',
      customHeaders: headers,
    };
  } else if (server.auth_token) {
    return {
      authMode: AuthModes.API_KEY,
      authToken: parseAuthToken(server.auth_token) ?? '',
      customHeaders: [{ key: '', value: '' }],
    };
  } else {
    return {
      authMode: AuthModes.NONE,
      authToken: '',
      customHeaders: [{ key: '', value: '' }],
    };
  }
}

export function parseArgsString(argsString: string): string[] {
  return argsString
    .split(',')
    .map((arg) => arg.trim())
    .filter((arg) => arg !== '');
}

export function parseEnvironmentArray(
  envArray: Array<{ key: string; value: string }>,
): Record<string, string> {
  if (!envArray) return {};
  return envArray
    .filter((env) => env.key && env.value)
    .reduce((acc: Record<string, string>, env) => {
      acc[env.key] = env.value;
      return acc;
    }, {});
}

export function environmentToArray(
  envObject: Record<string, string> | null | undefined,
): Array<{ key: string; value: string }> {
  if (!envObject) return [{ key: '', value: '' }];
  return Object.entries(envObject).map(([key, value]) => ({ key, value }));
}

/**
 * Parses a raw tool object (from backend) into an MCPTool.
 * Handles various possible shapes for name, description, and inputSchema.
 */
export function parseMCPTool(tool: any, index = 0): MCPTool {
  // Extract name from various possible locations
  const name = tool.name || tool.function?.name || `Tool ${index + 1}`;

  // Extract description from various possible locations
  const description =
    tool.description || tool.function?.description || undefined;

  // Extract input schema from various possible locations
  // Priority: inputSchema > json_schema > args_json_schema > function.parameters
  let inputSchema = undefined;
  if (tool.inputSchema && typeof tool.inputSchema === 'object') {
    inputSchema = tool.inputSchema;
  } else if (tool.json_schema && typeof tool.json_schema === 'object') {
    if (tool.json_schema.parameters) {
      inputSchema = tool.json_schema.parameters;
    } else {
      inputSchema = tool.json_schema;
    }
  } else if (
    tool.args_json_schema &&
    typeof tool.args_json_schema === 'object'
  ) {
    inputSchema = tool.args_json_schema;
  } else if (
    tool.function?.parameters &&
    typeof tool.function.parameters === 'object'
  ) {
    inputSchema = tool.function.parameters;
  }

  return {
    name,
    description,
    inputSchema,
  };
}

export { parseMCPJsonConfig as parseMCPConfig } from './configParser';
export type {
  MCPJsonServerConfig,
  MCPJsonConfig,
  ParsedJsonConfig,
} from './configParser';
