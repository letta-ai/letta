import type { SupportedProviders } from '$letta/types';
import { environment } from '@letta-web/environmental-variables';
import { NextResponse } from 'next/server';
import type { AuthProviderContextSchema } from '../types';

function generateOAuthStep1URL(provider: SupportedProviders) {
  switch (provider) {
    case 'google':
      return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${environment.GOOGLE_CLIENT_ID}&redirect_uri=${environment.GOOGLE_REDIRECT_URI}&response_type=code&scope=https://www.googleapis.com/auth/userinfo.email+https://www.googleapis.com/auth/userinfo.profile`;
    default:
      return '';
  }
}

export async function GET(e: Request, context: AuthProviderContextSchema) {
  const urlToRedirect = generateOAuthStep1URL(context.params.provider);

  return NextResponse.redirect(urlToRedirect, { status: 302 });
}
