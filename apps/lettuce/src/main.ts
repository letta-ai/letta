import { startLettuceServer } from '@letta-cloud/lettuce-server';
import * as Sentry from '@sentry/nextjs';

startLettuceServer().catch((err) => {
  Sentry.captureException(err);

  process.exit(1);
});
