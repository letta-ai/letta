// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://6a1b07c63936105cf6c53b3a1351d03d@o4507986077810688.ingest.us.sentry.io/4507986161303552',

  enabled: process.env.NODE_ENV === 'production',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: process.env.TAG,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});
