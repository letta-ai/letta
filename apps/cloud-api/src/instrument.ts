import * as profiler from '@google-cloud/profiler';
import * as Sentry from '@sentry/node';

// Initialize Google Cloud Profiler first
// Ensure to call this before importing any other modules!
if (process.env.NODE_ENV === 'production') {
  profiler.start({
    serviceContext: {
      service: 'cloud-api',
      version: process.env.APP_VERSION || '1.0.0',
    },
    logLevel: 4, // 0=error, 1=warn, 2=info, 3=debug, 4=trace
  }).catch((err) => {
    console.error('Failed to start Google Cloud Profiler:', err);
  });
}

// Initialize Sentry
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
