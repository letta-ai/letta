import { LOCAL_PROJECT_SERVER_PORT } from '$web/constants';
import type { InlineCodeProps } from '@letta-web/component-library';
import { InlineCode } from '@letta-web/component-library';
import React from 'react';

interface ConnectToLocalServerCommandProps {
  color?: InlineCodeProps['color'];
}

export function ConnectToLocalServerCommand(
  props: ConnectToLocalServerCommandProps
) {
  return (
    <InlineCode
      color={props.color}
      size="medium"
      code={`letta server --ade --port=${LOCAL_PROJECT_SERVER_PORT}`}
    />
  );
}
