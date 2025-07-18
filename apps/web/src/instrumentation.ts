export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');

    const handleMigrations = await import('./migrations/migrations');

    await handleMigrations.handleMigrations();
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export async function onRequestError(...rest: any) {
  if (process.env.NEXT_RUNTIME === 'edge') {
    const res = await import('@sentry/nextjs');

    // @ts-expect-error - dfa
    res.captureRequestError(...rest);
    return;
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const res = await import('@sentry/nextjs');

    // @ts-expect-error - daf
    res.captureRequestError(...rest);
    return;
  }

  return;
}
