import type { ExecuteToolInput, ExecuteToolOutput } from '@letta-cloud/types';

export interface MessageEventType {
  name: string;

  input: ExecuteToolInput | null;

  output: ExecuteToolOutput | null;
  stepDuration?: number;
  toolDuration?: number;
  llmDuration?: number;
  lettaDuration?: number;
  stepId: string;
  timestamp: string;
}
