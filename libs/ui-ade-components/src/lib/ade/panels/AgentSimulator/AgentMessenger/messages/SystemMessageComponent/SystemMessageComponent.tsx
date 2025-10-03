import type { SystemMessage } from '@letta-cloud/sdk-core';
import type { MessageAdditionalMetadata } from '../types';

interface SystemMessageComponentProps {
  message: SystemMessage;
  metadata: MessageAdditionalMetadata;
}

export function SystemMessageComponent(_props: SystemMessageComponentProps) {
  return null;
}
