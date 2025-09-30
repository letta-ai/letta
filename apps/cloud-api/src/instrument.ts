import * as Sentry from '@sentry/node';

// Ensure to call this before importing any other modules!
Sentry.init({
  dsn: 'https://1cdfe89576ddfb44d4d0fe8c957d32fd@o4507986077810688.ingest.us.sentry.io/4509018480246784',
  integrations: [],

  // Set profilesSampleRate to 1.0 to profile 100%
  // of sampled transactions.
  // This is relative to tracesSampleRate
  // Learn more at
  // https://docs.sentry.io/platforms/javascript/guides/node/configuration/options/#profilesSampleRate
  profilesSampleRate: 1.0,

  tracesSampleRate: 1.0,

  enabled: process.env.NODE_ENV === 'production',
});
