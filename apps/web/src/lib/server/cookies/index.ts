'use server';
import { cookies } from 'next/headers';
import type { CookieTypePayload } from './types';
import { CookieNames } from './types';

interface RequestCookieInterface {
  httpOnly: boolean;
  path: string;
  secure: boolean;
  expires?: Date;
}

const cookieConfiguration: Record<
  CookieNames,
  Partial<RequestCookieInterface>
> = {
  [CookieNames.CSRF_PROTECTION]: {
    httpOnly: true,
    path: '/',
    // safari does not allow secure cookies for localhost development
    secure: process.env.NODE_ENV === 'production',
  },
  [CookieNames.LETTA_SESSION]: {
    httpOnly: true,
    path: '/',
    // safari does not allow secure cookies for localhost development
    secure: process.env.NODE_ENV === 'production',
  },
  [CookieNames.THEME]: {
    httpOnly: true,
    path: '/',
  },
  [CookieNames.LOCALE]: {
    httpOnly: true,
    path: '/',
  },
};

export async function setCookie<CookieName extends CookieNames>(
  name: CookieName,
  payload: CookieTypePayload[CookieName],
  extraConfig?: Partial<RequestCookieInterface>
) {
  cookies().set(name, JSON.stringify(payload), {
    ...cookieConfiguration[name],
    ...extraConfig,
  });
}

export async function getCookie<CookieName extends CookieNames>(
  name: CookieName
): Promise<CookieTypePayload[CookieName] | null> {
  const cookie = cookies().get(name);

  if (!cookie) {
    return null;
  }

  return JSON.parse(cookie.value);
}

export async function deleteCookie<CookieName extends CookieNames>(
  name: CookieName
) {
  cookies().delete(name);
}
