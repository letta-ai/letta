'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import {
  Button,
  LoadingEmptyStatusComponent,
  VStack,
} from '@letta-web/component-library';

interface GlobalErrorProps {
  error: Error & { digest?: string };
}

export default function GlobalError({ error }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="w-screen h-screen">
        <VStack fullHeight fullWidth align="center" justify="center">
          <LoadingEmptyStatusComponent
            emptyMessage="Something went wrong"
            emptyAction={<Button label="Go home" href="/" />}
          />
        </VStack>
      </body>
    </html>
  );
}
