import  { type SupportedProviders, supportedProvidersSchema } from '@letta-cloud/sdk-web';
import { environment } from '@letta-cloud/config-environment-variables';
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
  const res = supportedProvidersSchema.safeParse((await context.params).provider);

  if (!res.success) {
    return new Response('Invalid provider', { status: 400 });
  }

  const authUrl = generateOAuthStep1URL(res.data);

  const redirectUrl = req.nextUrl.searchParams.get('redirect') || '';
  const inviteCode = req.nextUrl.searchParams.get('inviteCode') || undefined;

  const state = await generateOAuthStateUrl({
    redirectUrl,
    inviteCode,
  });

  return NextResponse.redirect(`${authUrl}&state=${state}`, { status: 302 });
}
