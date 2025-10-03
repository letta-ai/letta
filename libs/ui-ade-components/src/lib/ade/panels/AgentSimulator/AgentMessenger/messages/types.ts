import type { RunResponseMessage } from '../../../../../hooks';
import type { ToolReturnMessage } from '@letta-cloud/sdk-core';

export interface MessageAdditionalMetadata {
  hasNextMessageOrComplete: boolean;
  nextMessage?: RunResponseMessage | null;
  toolReturnMessage?: ToolReturnMessage | null;
}
