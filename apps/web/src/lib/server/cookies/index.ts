'use server';
import { cookies } from 'next/headers';
import type { CookieTypePayload } from './types';
import { CookieNames } from './types';
import { environment } from '@letta-cloud/config-environment-variables';

interface RequestCookieInterface {
  httpOnly: boolean;
  path: string;
  secure: boolean;
  domain?: string;
  expires?: Date;
}

const cloudAPIUrl = new URL(
  environment.CLOUD_API_ENDPOINT || 'http://localhost:3006',
);

const cookieConfiguration: Record<
  CookieNames,
  Partial<RequestCookieInterface>
> = {
  [CookieNames.CSRF_PROTECTION]: {
    httpOnly: false,
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
  [CookieNames.CLOUD_API_SESSION]: {
    httpOnly: true,
    path: '/',
    domain: `.${cloudAPIUrl.hostname}`,
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
  [CookieNames.LAST_VISITED_PROJECT]: {
    httpOnly: true,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  },
};

export async function setCookie<CookieName extends CookieNames>(
  name: CookieName,
  payload: CookieTypePayload[CookieName],
  extraConfig?: Partial<RequestCookieInterface>,
) {
  (await cookies()).set(name, JSON.stringify(payload), {
    ...cookieConfiguration[name],
    ...extraConfig,
  });
}

export async function getCookie<CookieName extends CookieNames>(
  name: CookieName,
): Promise<CookieTypePayload[CookieName] | null> {
  const cookie = (await cookies()).get(name);

  if (!cookie) {
    return null;
  }

  return JSON.parse(cookie.value);
}

export async function deleteCookie<CookieName extends CookieNames>(
  name: CookieName,
) {
  (await cookies()).delete(name);
}
