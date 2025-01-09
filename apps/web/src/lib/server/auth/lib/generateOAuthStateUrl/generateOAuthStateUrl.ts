import { getCookie, setCookie } from '$web/server/cookies';
import { CookieNames } from '$web/server/cookies/types';

export const STATE_SEPERATOR = '__';

interface GenerateOAuthStateUrlOptions {
  redirectUrl?: string;
  inviteCode?: string | undefined;
}

export async function generateOAuthStateUrl(
  options: GenerateOAuthStateUrlOptions,
) {
  const { redirectUrl, inviteCode } = options;
  const csrfKey = `csrf-${Math.random().toString(36).substring(2)}`;

  await setCookie(CookieNames.CSRF_PROTECTION, csrfKey);

  const base = [csrfKey];

  const obj: Record<string, string> = {};

  if (redirectUrl) {
    obj.redirectUrl = redirectUrl;
  }

  if (inviteCode) {
    obj.inviteCode = inviteCode;
  }

  base.push(JSON.stringify(obj));

  return base.join(STATE_SEPERATOR);
}

export async function isValidCSRFState(state: string) {
  const [csrfKey] = state.split(STATE_SEPERATOR);

  return (await getCookie(CookieNames.CSRF_PROTECTION)) === csrfKey;
}

export function getRedirectUrlFromState(state: string): string | undefined {
  try {
    const [, data] = state.split(STATE_SEPERATOR);

    const { redirectUrl } = JSON.parse(data);

    return redirectUrl;
  } catch (_) {
    return undefined;
  }
}

export function getInviteCodeFromState(state: string): string | undefined {
  try {
    const [, data] = state.split(STATE_SEPERATOR);

    const { inviteCode } = JSON.parse(data);

    return inviteCode;
  } catch (_) {
    return undefined;
  }
}
