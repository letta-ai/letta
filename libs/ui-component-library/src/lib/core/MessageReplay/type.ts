import type { ExecuteToolInput, ExecuteToolOutput } from '@letta-cloud/types';

export interface MessageEventType {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  input: ExecuteToolInput | null;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  output: ExecuteToolOutput | null;
  stepDuration?: number;
  toolDuration?: number;
  llmDuration?: number;
  lettaDuration?: number;
  stepId: string;
  timestamp: string;
}
