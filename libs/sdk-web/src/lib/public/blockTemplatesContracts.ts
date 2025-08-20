import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type { GenericSearch } from '../shared';
import { GenericSearchSchema } from '../shared';
import { BlockTemplateSchema } from '@letta-cloud/utils-shared';

const c = initContract();

export const BlockTemplatesSchema = z.array(BlockTemplateSchema);

export type BlockTemplateType = z.infer<typeof BlockTemplateSchema>;
export type BlockTemplatesType = z.infer<typeof BlockTemplatesSchema>;

/* Create Block Template */
export const CreateBlockTemplatePayloadSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  value: z.string(),
  limit: z.number().int().min(1, 'Limit must be at least 1').default(1),
  description: z.string(),
  preserveOnMigration: z.boolean().nullable().optional(),
  readOnly: z.boolean().default(false),
  projectId: z.string(),
  lettaTemplateId: z.string(),
});

const createBlockTemplateContract = c.mutation({
  method: 'POST',
  path: '/block-templates',
  body: CreateBlockTemplatePayloadSchema,
  responses: {
    201: BlockTemplateSchema,
    400: z.object({
      message: z.string(),
      errorCode: z.enum(['validation', 'maxUsage', 'default']),
    }),
  },
});

/* Create and Attach Block Template to Agent Template */
const createAndAttachBlockToAgentTemplateContract = c.mutation({
  method: 'POST',
  path: '/agent-templates/:agentTemplateId/block-templates',
  pathParams: z.object({
    agentTemplateId: z.string(),
  }),
  body: CreateBlockTemplatePayloadSchema,
  responses: {
    201: z.object({
      blockTemplate: BlockTemplateSchema,
      success: z.boolean(),
      message: z.string(),
    }),
    400: z.object({
      message: z.string(),
      errorCode: z.enum(['validation', 'conflict', 'default']),
    }),
    404: z.object({
      message: z.string(),
    }),
  },
});

/* Update Block Template */
export const UpdateBlockTemplatePayloadSchema = z.object({
  label: z.string().min(1, 'Label is required').optional(),
  value: z.string().optional(),
  limit: z.number().int().min(1, 'Limit must be at least 1').optional(),
  description: z.string().optional(),
  preserveOnMigration: z.boolean().nullable().optional(),
  readOnly: z.boolean().optional(),
});

export type UpdateBlockTemplatePayloadType = z.infer<
  typeof UpdateBlockTemplatePayloadSchema
>;

const updateBlockTemplateContract = c.mutation({
  method: 'PATCH',
  path: '/block-templates/:blockTemplateId',
  pathParams: z.object({
    blockTemplateId: z.string(),
  }),
  body: UpdateBlockTemplatePayloadSchema,
  responses: {
    200: BlockTemplateSchema,
    400: z.object({
      message: z.string(),
      errorCode: z.enum(['validation', 'default']),
    }),
    404: z.object({
      message: z.string(),
    }),
  },
});

/* Get Block Templates */
const GetBlockTemplatesResponseSchema = z.object({
  blockTemplates: BlockTemplatesSchema,
  hasNextPage: z.boolean(),
});

const getBlockTemplatesContract = c.query({
  method: 'GET',
  query: GenericSearchSchema.extend({
    projectId: z.string().optional(),
  }),
  path: '/block-templates',
  responses: {
    200: GetBlockTemplatesResponseSchema,
  },
});

/* Get Single Block Template */
const getBlockTemplateContract = c.query({
  method: 'GET',
  path: '/block-templates/:blockTemplateId',
  pathParams: z.object({
    blockTemplateId: z.string(),
  }),
  responses: {
    200: BlockTemplateSchema,
    404: z.object({
      message: z.string(),
    }),
  },
});

/* Delete Block Template */
const deleteBlockTemplateContract = c.mutation({
  method: 'DELETE',
  path: '/block-templates/:blockTemplateId',
  pathParams: z.object({
    blockTemplateId: z.string(),
  }),
  body: null,
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
    404: z.object({
      message: z.string(),
    }),
  },
});

/* Attach Block Template to Agent Template */
const attachBlockToAgentTemplateContract = c.mutation({
  method: 'POST',
  path: '/agent-templates/:agentTemplateId/block-templates/:blockTemplateId',
  pathParams: z.object({
    agentTemplateId: z.string(),
    blockTemplateId: z.string(),
  }),
  body: null,
  responses: {
    201: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
    400: z.object({
      message: z.string(),
      errorCode: z.enum(['validation', 'conflict', 'default']),
    }),
    404: z.object({
      message: z.string(),
    }),
  },
});

/* Detach Block Template from Agent Template */
const detachBlockFromAgentTemplateContract = c.mutation({
  method: 'DELETE',
  path: '/agent-templates/:agentTemplateId/block-templates/:blockTemplateId',
  pathParams: z.object({
    agentTemplateId: z.string(),
    blockTemplateId: z.string(),
  }),
  body: null,
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
    404: z.object({
      message: z.string(),
    }),
  },
});

/* List Block Templates for Agent Template */
const getAgentTemplateBlockTemplatesContract = c.query({
  method: 'GET',
  path: '/agent-templates/:agentTemplateId/block-templates',
  pathParams: z.object({
    agentTemplateId: z.string(),
  }),
  responses: {
    200: z.object({
      blockTemplates: BlockTemplatesSchema,
    }),
    404: z.object({
      message: z.string(),
    }),
  },
});

export const blockTemplatesContracts = c.router({
  createBlockTemplate: createBlockTemplateContract,
  updateBlockTemplate: updateBlockTemplateContract,
  getBlockTemplates: getBlockTemplatesContract,
  getBlockTemplate: getBlockTemplateContract,
  deleteBlockTemplate: deleteBlockTemplateContract,
  attachBlockToAgentTemplate: attachBlockToAgentTemplateContract,
  detachBlockFromAgentTemplate: detachBlockFromAgentTemplateContract,
  getAgentTemplateBlockTemplates: getAgentTemplateBlockTemplatesContract,
  createAndAttachBlockToAgentTemplate:
    createAndAttachBlockToAgentTemplateContract,
});

export const blockTemplatesQueryKeys = {
  getBlockTemplates: ['blockTemplates'],
  getBlockTemplatesWithSearch: (
    search: GenericSearch & { projectId?: string },
  ) => ['blockTemplates', search],
  getBlockTemplate: (blockTemplateId: string) => [
    'blockTemplates',
    blockTemplateId,
  ],
  getAgentTemplateBlockTemplates: (agentTemplateId: string) => [
    'agentTemplates',
    agentTemplateId,
    'blockTemplates',
  ],
};
