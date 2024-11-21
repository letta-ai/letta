import type { Block } from '@letta-web/letta-agents-api';

export interface ComputeCoreMemoryWorkerPayload {
  templateString: string;
  context: {
    memory: Record<string, Block>;
  };
}

export interface ComputeTokenCountWorkerPayload {
  text: string;
  model: string;
}

export type WorkerResponse = string;
