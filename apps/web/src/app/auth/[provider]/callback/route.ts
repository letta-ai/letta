import axios from 'axios';
import type { AuthProviderContextSchema } from '../types';
import {
  type ProviderUserPayload,
  type SupportedProviders, supportedProvidersSchema
} from '@letta-cloud/sdk-web';
import type { NextRequest } from 'next/server';
import {
  extractGoogleIdTokenData,
  generateRedirectSignatureForLoggedInUser,
  getGithubUserDetails,
  getInviteCodeFromState,
  getRedirectUrlFromState,
  isValidCSRFState,
  signInUserFromProviderLogin
} from '$web/server/auth';
import { LoginErrorsEnum } from '$web/errors';
import * as Sentry from '@sentry/node';
import { parseInviteCode } from '$web/utils';
import { WorkOS } from '@workos-inc/node';
import {
  db,
  organizationSSOConfiguration
} from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';

interface GoogleAccessTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  id_token: string;
}

async function getAccessTokenFromGoogle(
  code: string
): Promise<ProviderUserPayload> {
  const response = await axios.post<GoogleAccessTokenResponse>(
    'https://oauth2.googleapis.com/token',
    {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.GOOGLE_REDIRECT_URI
    }
  );

  return extractGoogleIdTokenData(response.data.id_token);
}

async function getAccessTokenFromGithub(
  code: string
): Promise<ProviderUserPayload> {
  const response = await axios.post<string>(
    'https://github.com/login/oauth/access_token',
    {
      client_id: process.env.AUTH_GITHUB_CLIENT_ID,
      client_secret: process.env.AUTH_GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.AUTH_GITHUB_REDIRECT_URI
    }
  );

  const accessToken = new URLSearchParams(response.data).get('access_token');

  if (!accessToken) {
    throw new Error('Could not get access token from Github');
  }

  return getGithubUserDetails(accessToken);
}

async function getDetailsFromWorkOS(
  code: string
): Promise<ProviderUserPayload> {
  const workos = new WorkOS(process.env.WORKOS_API_KEY);

  const { profile } = await workos.sso.getProfileAndToken({
    code,
    clientId: process.env.WORKOS_CLIENT_ID || ''
  });

  if (!profile.organizationId) {
    throw new Error('Organization not found');
  }

  const org = await db.query.organizationSSOConfiguration.findFirst({
    where: eq(
      organizationSSOConfiguration.workOSOrganizationId,
      profile.organizationId
    )
  });

  if (!org) {
    throw new Error('Organization not found');
  }

  return {
    email: profile.email,
    uniqueId: `workos-sso-${profile.id}`,
    name: [profile.firstName, profile.lastName].filter(Boolean).join(' '),
    imageUrl: '',
    isVerified: true,
    organizationOverride: org.organizationId,
    provider: 'workos-sso'
  };
}

async function getUserDetailsFromProvider(
  provider: SupportedProviders,
  code: string
): Promise<ProviderUserPayload> {
  switch (provider) {
    case 'google':
      return getAccessTokenFromGoogle(code);
    case 'github':
      return getAccessTokenFromGithub(code);
    case 'workos-sso':
      return getDetailsFromWorkOS(code);
    default:
      throw new Error('Unsupported provider');
  }
}

export async function GET(
  req: NextRequest,
  context: AuthProviderContextSchema
) {
  try {
    const { provider } = await context.params;

    const code = req.nextUrl.searchParams.get('code');
    const state = req.nextUrl.searchParams.get('state');

    if (provider !== 'workos-sso') {
      if (!state || !isValidCSRFState(state)) {
        return new Response('Invalid CSRF state', { status: 400 });
      }
    }

    if (!code) {
      return new Response('No code provided', { status: 400 });
    }

    const res = supportedProvidersSchema.safeParse(provider);

    if (!res.success) {
      return new Response('Invalid provider', { status: 400 });
    }

    const userPayload = await getUserDetailsFromProvider(res.data, code);

    const inviteCode = getInviteCodeFromState(state || '');

    if (inviteCode) {
      const { email, isExpired } = parseInviteCode(inviteCode);

      if (isExpired) {
        return new Response('Error signing in', {
          status: 302,
          headers: {
            location: `/signup-via-invite?errorCode=${LoginErrorsEnum.INVALID_INVITE_CODE}&code=${inviteCode}`
          }
        });
      }

      if (email !== userPayload.email) {
        return new Response('Error signing in', {
          status: 302,
          headers: {
            location: `/signup-via-invite?errorCode=${LoginErrorsEnum.INVITE_MISMATCH_EMAIL}&code=${inviteCode}`
          }
        });
      }
    }

    const { newUserDetails } = await signInUserFromProviderLogin(userPayload);

    const redirectUrl = getRedirectUrlFromState(state || '');
    return generateRedirectSignatureForLoggedInUser({
      newUserDetails,
      redirectUrl
    });
  } catch (e) {
    const errorCode = (() => {
      if (e instanceof Error) {
        if (Object.values(LoginErrorsEnum).some((code) => code === e.message)) {
          return e.message;
        }

        Sentry.captureException(e);

        return LoginErrorsEnum.UNKNOWN_ERROR_CONTACT_SUPPORT;
      }

      Sentry.captureException(e);

      return LoginErrorsEnum.UNKNOWN_ERROR_CONTACT_SUPPORT;
    })();

    return new Response('Error signing in', {
      status: 302,
      headers: {
        location: `/login?errorCode=${errorCode}`
      }
    });
  }
}
