import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type { GenericSearch } from '../shared';
import { GenericSearchSchema } from '../shared';

const c = initContract();

export const AbTestTemplatesSchema = z.object({
  templateName: z.string(),
  id: z.string(),
  coreAgentId: z.string(),
  simulatedAgentId: z.string(),
});

export type AbTestTemplatesSchemaType = z.infer<typeof AbTestTemplatesSchema>;

export const PublicAbTestSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  organizationId: z.string(),
  projectId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const AbTestsSchema = z.array(PublicAbTestSchema);

export type AbTestType = z.infer<typeof PublicAbTestSchema>;
export type AbTestsType = z.infer<typeof AbTestsSchema>;

/* Create AB Test */
export const CreateAbTestPayloadSchema = z.object({
  uuid: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  projectId: z.string(),
});

const createAbTestContract = c.mutation({
  method: 'POST',
  path: '/ab-tests',
  body: CreateAbTestPayloadSchema,
  responses: {
    201: PublicAbTestSchema,
    400: z.object({
      message: z.string(),
      limit: z.number().optional(),
      errorCode: z.enum(['usageLimit', 'validation']),
    }),
  },
});

/* Update AB Test */
export const UpdateAbTestPayloadSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional(),
});

const updateAbTestContract = c.mutation({
  method: 'PATCH',
  path: '/ab-tests/:abTestId',
  pathParams: z.object({
    abTestId: z.string(),
  }),
  body: UpdateAbTestPayloadSchema,
  responses: {
    200: PublicAbTestSchema,
    400: z.object({
      message: z.string(),
      errorCode: z.enum(['validation', 'default']),
    }),
    404: z.object({
      message: z.string(),
    }),
  },
});

/* Get AB Tests */
const GetAbTestsResponseSchema = z.object({
  abTests: AbTestsSchema,
  hasNextPage: z.boolean(),
});

const getAbTestsContract = c.query({
  method: 'GET',
  query: GenericSearchSchema.extend({
    projectId: z.string().optional(),
  }),
  path: '/ab-tests',
  responses: {
    200: GetAbTestsResponseSchema,
  },
});

/* Get Single AB Test */
const getAbTestContract = c.query({
  method: 'GET',
  path: '/ab-tests/:abTestId',
  pathParams: z.object({
    abTestId: z.string(),
  }),
  responses: {
    200: PublicAbTestSchema,
    404: z.object({
      message: z.string(),
    }),
  },
});

/* Delete AB Test */
const deleteAbTestContract = c.mutation({
  method: 'DELETE',
  path: '/ab-tests/:abTestId',
  pathParams: z.object({
    abTestId: z.string(),
  }),
  body: null,
  responses: {
    200: z.object({
      success: z.literal(true),
    }),
    404: z.object({
      message: z.string(),
    }),
  },
});

const GetAbTestTemplatesResponse = z.object({
  templates: z.array(AbTestTemplatesSchema),
});

const getAbTestTemplatesContract = c.query({
  path: '/ab-tests/:abTestId/templates',
  method: 'GET',
  pathParams: z.object({
    abTestId: z.string(),
  }),
  responses: {
    200: GetAbTestTemplatesResponse,
    404: z.object({
      message: z.string(),
    }),
  },
});

const attachAbTestTemplateContract = c.mutation({
  path: '/ab-tests/:abTestId/templates',
  method: 'POST',
  pathParams: z.object({
    abTestId: z.string(),
  }),
  body: z.object({
    templateName: z.string(),
    memoryVariables: z.record(z.string(), z.string()).optional(),
  }),
  responses: {
    200: AbTestTemplatesSchema,
    404: z.object({
      message: z.string(),
    }),
  },
});

const detachAbTestTemplateContract = c.mutation({
  path: '/ab-tests/:abTestId/templates/:attachedTemplateId',
  method: 'DELETE',
  pathParams: z.object({
    abTestId: z.string(),
    attachedTemplateId: z.string(),
  }),
  body: z.undefined(),
  responses: {
    200: z.object({
      success: z.literal(true),
    }),
    404: z.object({
      message: z.string(),
    }),
  },
});

export const abTestContracts = c.router({
  createAbTest: createAbTestContract,
  updateAbTest: updateAbTestContract,
  getAbTests: getAbTestsContract,
  getAbTest: getAbTestContract,
  deleteAbTest: deleteAbTestContract,
  getAbTestTemplates: getAbTestTemplatesContract,
  attachAbTestTemplate: attachAbTestTemplateContract,
  detachAbTestTemplate: detachAbTestTemplateContract,
});

export const abTestQueryKeys = {
  getAbTests: ['ab-tests'],
  getAbTestWithProject: (projectId: string) => ['ab-tests', projectId],
  getAbTestsWithSearch: (projectId: string, search?: GenericSearch) => [
    ...abTestQueryKeys.getAbTestWithProject(projectId),
    ...(search ? [search] : []),
  ],
  getAbTest: (abTestId: string) => ['ab-tests', abTestId],
  getAbTestTemplates: (abTestId: string) => ['ab-tests', abTestId, 'templates'],
};
