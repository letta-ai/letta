import { LOCAL_PROJECT_SERVER_PORT } from '$letta/constants';
import { InlineCode } from '@letta-web/component-library';
import React from 'react';

export function ConnectToLocalServerCommand() {
  return (
    <InlineCode
      code={`letta server --ade --port=${LOCAL_PROJECT_SERVER_PORT}`}
    />
  );
}
