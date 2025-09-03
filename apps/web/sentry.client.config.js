// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://6a1b07c63936105cf6c53b3a1351d03d@o4507986077810688.ingest.us.sentry.io/4507986161303552',

  enabled: process.env.NODE_ENV === 'production',

  // Add optional integrations for additional features
  integrations: [
    Sentry.replayIntegration(),
    Sentry.thirdPartyErrorFilterIntegration({
      filterKeys: ['letta-web-ui'],
      behaviour: 'drop-error-if-contains-third-party-frames',
    }),
  ],

  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: process.env.TAG,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  denyUrls: [
    /extensions\//i,
    /^chrome:\/\//i,
    /127\.0\.0\.1/i,
    /localhost/i,
    /^https?:\/\/192\.168\.*/i,
    // ignore any sentry errors on development-servers (https://app.letta.com/development-servers/*/agents/*)
    /^https?:\/\/app\.letta\.com\/development-servers\/.*\/agents\/.*/i,
  ],
  ignoreErrors: [
    'NEXT_REDIRECT',
    'NEXT_NOT_FOUND',
    'User not found',
    'abortIncoming(node:_http_server)',
    'Hydration Error',
    'ResponseAborted',
    // this is an unavoidable echarts error, but does not cause any failure on the page itself
    "Cannot read properties of undefined (reading 'getRawIndex')",
  ],
});
