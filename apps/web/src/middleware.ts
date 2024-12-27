import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { CURRENT_PATH_HEADER } from '$web/constants';

export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(CURRENT_PATH_HEADER, request.nextUrl.pathname);
  return NextResponse.next({ headers });
}
