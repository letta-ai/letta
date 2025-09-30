//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');
const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin();

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
let nextConfig = {
  assetPrefix:
    process.env.NODE_ENV === 'production' &&
    process.env.IS_CYPRESS_RUN !== 'yes'
      ? 'https://web-cdn.letta.com'
      : '',
  nx: {
    // Set this to true if you would like to use SVGR
    // See: https://github.com/gregberge/svgr
    svgr: false,
  },
  serverExternalPackages: ['@react-email/components', '@react-email/tailwind'],
  experimental: {
    turbo: {
      minify: false,
    },
    // swcPlugins: [['@swc-jotai/react-refresh', {}]],
  },
  // Use the Redis cache handler
  cacheHandler: require.resolve('./redis-cache-handler.js'),
  cacheMaxMemorySize: 0,
  sentry: {
    deleteSourcemapsAfterUpload: true,
  },
  output: 'standalone',
  async rewrites() {
    return [
      // {
      //   source: '/v1/:path*',
      //   destination: `${process.env.CLOUD_API_ENDPOINT || 'https://api.letta.com'}/v1/:path*`,
      // },
      {
        source: '/openai/:path*',
        destination: `${process.env.OPENAI_API_ENDPOINT || 'https://api.letta.com'}/openai/:path*`,
      },
    ];
  },
};

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const plugins = [
  withNextIntl,
  // Add more Next.js plugins to this list if needed.
  withNx,
  withBundleAnalyzer,
];

const { withSentryConfig } = require('@sentry/nextjs');

nextConfig = withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: 'letta-ai',
  project: 'letta-web',
  sentryUrl: 'https://sentry.io/',
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Automatically annotate React components to show their full name in breadcrumbs and session replay
  reactComponentAnnotation: {
    enabled: true,
  },

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: '/monitoring',

  // Hides source maps from generated client bundles
  sourcemaps: {
    disable: true,
  },

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: false,
  unstable_sentryWebpackPluginOptions: {
    applicationKey: 'letta-web-ui',
  },
});

module.exports = composePlugins(...plugins)(nextConfig);
