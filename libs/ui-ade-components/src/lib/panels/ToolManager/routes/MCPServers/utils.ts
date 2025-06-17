import { AUTH_TOKEN_BEARER_PREFIX } from './constants';

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
