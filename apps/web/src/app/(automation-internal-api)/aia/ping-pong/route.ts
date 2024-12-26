import type { NextRequest } from 'next/server';
import { startPingPong } from '@letta-cloud/lettuce-client';

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name');

  return new Response(await startPingPong(name || 'unknown'), { status: 200 });
}
