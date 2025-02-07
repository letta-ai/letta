import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.UNDERTAKER_SENTRY_DSN,
  integrations: [],
  // Tracing
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
});
