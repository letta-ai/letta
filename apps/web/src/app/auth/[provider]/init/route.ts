import type { SupportedProviders } from '@letta-cloud/web-api-client';
import { environment } from '@letta-web/environmental-variables';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import type { AuthProviderContextSchema } from '../types';
import { generateOAuthStateUrl } from '$web/server/auth/lib/generateOAuthStateUrl/generateOAuthStateUrl';

function generateOAuthStep1URL(provider: SupportedProviders) {
  switch (provider) {
    case 'google':
      return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${environment.GOOGLE_CLIENT_ID}&redirect_uri=${environment.GOOGLE_REDIRECT_URI}&response_type=code&scope=https://www.googleapis.com/auth/userinfo.email+https://www.googleapis.com/auth/userinfo.profile`;
    case 'github':
      return `https://github.com/login/oauth/authorize?client_id=${environment.AUTH_GITHUB_CLIENT_ID}&redirect_uri=${environment.AUTH_GITHUB_REDIRECT_URI}&scope=user:email,read:user`;
    default:
      return '';
  }
}

export async function GET(
  req: NextRequest,
  context: AuthProviderContextSchema,
) {
  const authUrl = generateOAuthStep1URL((await context.params).provider);

  const returnUrl = req.nextUrl.searchParams.get('redirect');
  const state = await generateOAuthStateUrl(returnUrl || '');

  return NextResponse.redirect(`${authUrl}&state=${state}`, { status: 302 });
}
