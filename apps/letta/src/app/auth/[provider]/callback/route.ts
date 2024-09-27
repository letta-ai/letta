import axios from 'axios';
import type { AuthProviderContextSchema } from '../types';
import type { ProviderUserPayload, SupportedProviders } from '$letta/types';
import type { NextRequest } from 'next/server';
import {
  extractGoogleIdTokenData,
  generateRedirectSignatureForLoggedInUser,
  signInUserFromProviderLogin,
} from '$letta/server/auth';
import { LoginErrorsEnum } from '$letta/errors';
import * as Sentry from '@sentry/node';

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
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    }
  );

  return extractGoogleIdTokenData(response.data.id_token);
}

async function getUserDetailsFromProvider(
  provider: SupportedProviders,
  code: string
): Promise<ProviderUserPayload> {
  switch (provider) {
    case 'google':
      return getAccessTokenFromGoogle(code);
    default:
      throw new Error('Unsupported provider');
  }
}

export async function GET(
  req: NextRequest,
  context: AuthProviderContextSchema
) {
  try {
    const code = req.nextUrl.searchParams.get('code');

    if (!code) {
      return new Response('No code provided', { status: 400 });
    }

    const userPayload = await getUserDetailsFromProvider(
      context.params.provider,
      code
    );

    const { newUserDetails } = await signInUserFromProviderLogin(userPayload);

    return generateRedirectSignatureForLoggedInUser({
      newUserDetails,
    });
  } catch (e) {
    console.error(e);
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
        location: `/login?errorCode=${errorCode}`,
      },
    });
  }
}
