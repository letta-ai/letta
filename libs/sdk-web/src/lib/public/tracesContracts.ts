import { z } from 'zod';
import { initContract } from '@ts-rest/core';
import { OtelTraceSchema } from '@letta-cloud/types';

const c = initContract();

const getTraceContract = c.query({
  path: '/traces/:traceId',
  method: 'GET',
  pathParams: z.object({
    traceId: z.string(),
  }),
  responses: {
    200: OtelTraceSchema.array(),
  },
});

export const tracesContracts = c.router({
  getTrace: getTraceContract,
});

export const tracesQueryKeys = {
  getTrace: (traceId: string) => ['traces', traceId] as const,
};
