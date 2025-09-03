import type { Block } from '@letta-cloud/sdk-core';

export interface ComputeCoreMemoryWorkerPayload {
  templateString: string;
  context: {
    memory: Block[];
  };
}

export interface ComputeTokenCountWorkerPayload {
  text: string;
  model: string;
}

export type WorkerResponse = string;
