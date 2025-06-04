'use client';

import type { ServerInferResponseBody } from '@ts-rest/core';
import type { webApiContracts } from '@letta-cloud/sdk-web';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import Intercom from '@intercom/messenger-js-sdk';
import { useCurrentUser } from '$web/client/hooks';
import { ErrorBoundary } from 'react-error-boundary';
import React from 'react';

interface IntercomInnerProps {
  user: ServerInferResponseBody<
    typeof webApiContracts.user.getCurrentUser,
    200
  >;
  showLauncher: boolean;
  intercomToken: string;
}

function IntercomInner(props: IntercomInnerProps) {
  const { user, intercomToken, showLauncher = true } = props;

  Intercom({
    app_id: 'bh43zesl',
    name: user.name,
    intercom_user_jwt: intercomToken,
    hide_default_launcher: !showLauncher,
  });

  return <div />;
}

interface IntercomSetupProps {
  showLauncher?: boolean;
}

export function IntercomSetup(props: IntercomSetupProps) {
  const { showLauncher = true } = props;
  const user = useCurrentUser();
  const { data: intercomToken } = webApi.user.getIntercomToken.useQuery({
    queryKey: webApiQueryKeys.user.getIntercomToken,
  });

  if (!user || !intercomToken?.body.token) {
    return null;
  }

  return (
    <ErrorBoundary fallback={null}>
      <IntercomInner
        intercomToken={intercomToken.body.token}
        showLauncher={showLauncher}
        user={user}
      />
    </ErrorBoundary>
  );
}
