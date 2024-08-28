'use server';
import { cookies } from 'next/headers';

export interface CookieSessionType {
  sessionId: string;
}

export enum CookieNames {
  CSRF_PROTECTION = 'CSRF_PROTECTION',
  LETTA_SESSION = '__LETTA_SESSION__',
}

export interface CookieTypePayload {
  [CookieNames.LETTA_SESSION]: CookieSessionType;
  [CookieNames.CSRF_PROTECTION]: string;
}

interface RequestCookieInterface {
  httpOnly: boolean;
  path: string;
  secure: boolean;
}

const cookieConfiguration: Record<
  CookieNames,
  Partial<RequestCookieInterface>
> = {
  [CookieNames.CSRF_PROTECTION]: {
    httpOnly: true,
    path: '/',
    secure: true,
  },
  [CookieNames.LETTA_SESSION]: {
    httpOnly: true,
    path: '/',
    secure: true,
  },
};

export async function setCookie<CookieName extends CookieNames>(
  name: CookieName,
  payload: CookieTypePayload[CookieName]
) {
  cookies().set(name, JSON.stringify(payload), cookieConfiguration[name]);
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
