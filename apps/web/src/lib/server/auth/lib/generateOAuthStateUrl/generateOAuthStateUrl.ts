import { nanoid } from 'nanoid';
import { getCookie, setCookie } from '$web/server/cookies';
import { CookieNames } from '$web/server/cookies/types';

export const STATE_SEPERATOR = '__';

export async function generateOAuthStateUrl(redirectUrl?: string) {
  const csrfKey = nanoid(15);

  await setCookie(CookieNames.CSRF_PROTECTION, csrfKey);

  const base = [csrfKey];

  if (redirectUrl) {
    base.push(redirectUrl);
  }

  return base.join(STATE_SEPERATOR);
}

export async function isValidCSRFState(state: string) {
  const [csrfKey] = state.split(STATE_SEPERATOR);

  return (await getCookie(CookieNames.CSRF_PROTECTION)) === csrfKey;
}

export function getRedirectUrlFromState(state: string): string | undefined {
  return state.split(STATE_SEPERATOR)[1] || undefined;
}
