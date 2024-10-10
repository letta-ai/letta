import type { Block } from '@letta-web/letta-agents-api';

export interface WorkerPayload {
  templateString: string;
  context: {
    memory: Record<string, Block>;
  };
}

export type WorkerResponse = string;
