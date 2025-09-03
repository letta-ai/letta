// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://6a1b07c63936105cf6c53b3a1351d03d@o4507986077810688.ingest.us.sentry.io/4507986161303552',

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  enabled: process.env.NODE_ENV === 'production',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: process.env.TAG,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  ignoreErrors: [
    'NEXT_REDIRECT',
    'ApiError: Conflict',
    'NEXT_NOT_FOUND',
    'User not found',
    'abortIncoming(node:_http_server)',
    'Hydration Error',
    'ResponseAborted',
    'ApiError: Not Found',
    // this is an unavoidable echarts error, but does not cause any failure on the page itself
    "Cannot read properties of undefined (reading 'getRawIndex')",
  ],
});
