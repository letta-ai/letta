import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();
const ViolationSchema = z.object({
  id: z.string(),
  reasons: z.array(z.string()),
  organizationId: z.string(),
  organizationName: z.string(),
  flaggedAt: z.string(),
  content: z.string(),
});

export type Violation = z.infer<typeof ViolationSchema>;

const adminGetContentViolationsContract = c.query({
  path: '/admin/content-violations',
  method: 'GET',
  query: z.object({
    limit: z.number().int().max(20).positive().optional(),
    offset: z.number().int().optional(),
  }),
  responses: {
    200: z.object({
      violations: ViolationSchema.array(),
      hasNextPage: z.boolean(),
    }),
  },
});

export const adminContentViolationsContracts = {
  adminGetContentViolations: adminGetContentViolationsContract,
};
export const adminContentViolationQueryKeys = {
  adminGetContentViolations: (limit?: number, offset?: number) => [
    adminGetContentViolationsContract.path,
    {
      limit,
      offset,
    },
  ],
};
