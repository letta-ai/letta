import { LOCAL_PROJECT_SERVER_PORT } from '$web/constants';
import type { InlineCodeProps } from '@letta-cloud/ui-component-library';
import { InlineCode } from '@letta-cloud/ui-component-library';
import React from 'react';

interface ConnectToLocalServerCommandProps {
  color?: InlineCodeProps['color'];
}

export function ConnectToLocalServerCommand(
  props: ConnectToLocalServerCommandProps,
) {
  return (
    <InlineCode
      color={props.color}
      size="medium"
      code={`letta server --port=${LOCAL_PROJECT_SERVER_PORT}`}
    />
  );
}
