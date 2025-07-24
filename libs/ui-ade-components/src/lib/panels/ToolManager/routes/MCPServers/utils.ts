import { AUTH_TOKEN_BEARER_PREFIX } from './constants';
import { AuthModes, type CustomHeader } from './FormFields';

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

export { parseMCPJsonConfig as parseMCPConfig } from './configParser';
export type {
  MCPJsonServerConfig,
  MCPJsonConfig,
  ParsedJsonConfig,
} from './configParser';
