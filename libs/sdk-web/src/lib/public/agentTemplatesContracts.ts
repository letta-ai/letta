import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { VersionedTemplateType, zodTypes } from '@letta-cloud/sdk-core';
import type { AgentState as AgentStateType } from '@letta-cloud/sdk-core';
import { MigrationStatus } from '@letta-cloud/sdk-cloud-api';
import { ProjectAgentTemplateSchema } from './projectContracts';

const c = initContract();

export const AgentTemplateSchema = z.object({
  name: z.string(),
  id: z.string(),
  latestDeployedVersion: z.string().optional(),
  latestDeployedId: z.string().optional(),
  updatedAt: z.string(),
  agentState: z.nullable(zodTypes.AgentState.optional()),
});

export const AgentTemplatesSchema = z.array(AgentTemplateSchema);

export type AgentTemplateType = z.infer<typeof AgentTemplateSchema>;

/* List Agent Templates */
export const ListAgentTemplatesResponseSchema = z.object({
  agentTemplates: AgentTemplatesSchema,
  hasNextPage: z.boolean(),
});

export type ListAgentTemplatesResponse = z.infer<
  typeof ListAgentTemplatesResponseSchema
>;

export const ListAgentTemplatesQuerySchema = z.object({
  limit: z.number().optional(),
  offset: z.number().optional(),
  search: z.string().optional(),
  name: z.string().optional(),
  projectId: z.string().optional(),
  includeLatestDeployedVersion: z.boolean().optional(),
  includeAgentState: z.boolean().optional(),
});

export type ListAgentTemplatesQuery = z.infer<
  typeof ListAgentTemplatesQuerySchema
>;

export const listAgentTemplatesContract = c.query({
  method: 'GET',
  path: '/agent-templates',
  query: ListAgentTemplatesQuerySchema,
  responses: {
    200: ListAgentTemplatesResponseSchema,
  },
});

/* Fork Testing Agent */
const ForkAgentTemplateParamsSchema = z.object({
  projectId: z.string(),
  agentTemplateId: z.string(),
});

const forkAgentTemplateContract = c.mutation({
  method: 'POST',
  path: '/projects/:projectId/testing-agents/:agentTemplateId/fork',
  pathParams: ForkAgentTemplateParamsSchema,
  body: z.undefined(),
  responses: {
    201: ProjectAgentTemplateSchema,
  },
});

/* Get Agent Template Simulation Session */
const GetAgentTemplateSessionParamsSchema = z.object({
  agentTemplateId: z.string(),
});

type GetAgentTemplateSessionParams = z.infer<
  typeof GetAgentTemplateSessionParamsSchema
>;

export const GetAgentTemplateSessionResponseSchema = c.type<{
  id: string;
  agentId: string;
  memoryVariables: Record<string, string>;
  toolVariables: Record<string, string>;
  agent: AgentStateType;
}>();

const getAgentTemplateByVersionContract = c.query({
  method: 'GET',
  path: '/template-versions/:slug',
  pathParams: z.object({
    slug: z.string(),
  }),
  responses: {
    200: VersionedTemplateType,
  },
});

const getAgentTemplateByIdContract = c.query({
  method: 'GET',
  path: '/agent-templates/:id',
  pathParams: z.object({
    id: z.string(),
  }),
  query: z.object({
    includeState: z.boolean().optional(),
  }),
  responses: {
    200: AgentTemplateSchema,
  },
});

const DeployedAgentTemplateSchema = z.object({
  id: z.string(),
  fullVersion: z.string(),
  agentTemplateId: z.string(),
  templateName: z.string(),
  projectId: z.string(),
  createdAt: z.string(),
});

const getDeployedAgentTemplateByIdContract = c.query({
  path: '/deployed-agent-templates/:id',
  method: 'GET',
  pathParams: z.object({
    id: z.string(),
  }),
  responses: {
    200: DeployedAgentTemplateSchema,
  },
});

const ListTemplateVersionsQuerySchema = z.object({
  limit: z.number().optional(),
  offset: z.number().optional(),
  versionId: z.string().optional(),
});

export type ListTemplateVersionsQuery = z.infer<
  typeof ListTemplateVersionsQuerySchema
>;

export const MigrationDetailSchema = z.object({
  workflowId: z.string(),
  status: z.nativeEnum(MigrationStatus),
  completedAt: z.string().optional(),
  startedAt: z.string(),
  templateVersion: z.string().optional(),
});

export type MigrationDetail = z.infer<typeof MigrationDetailSchema>;

export const ListAgentMigrationsResponseSchema = z.object({
  migrations: z.array(MigrationDetailSchema),
  nextPage: z.string().nullable(),
});

export type ListAgentMigrationsResponse = z.infer<
  typeof ListAgentMigrationsResponseSchema
>;

export const ListAgentMigrationsQuerySchema = z.object({
  templateName: z.string(),
  limit: z.number().max(50).optional(),
  cursor: z.any().optional(),
});

export type ListAgentMigrationsQuery = z.infer<
  typeof ListAgentMigrationsQuerySchema
>;

const listAgentMigrationsContract = c.query({
  method: 'GET',
  path: '/agent-templates/migrations',
  query: ListAgentMigrationsQuerySchema,
  responses: {
    200: ListAgentMigrationsResponseSchema,
  },
});

/* Abort Agent Migration */
export const AbortAgentMigrationParamsSchema = z.object({
  workflowId: z.string(),
});

export type AbortAgentMigrationParams = z.infer<
  typeof AbortAgentMigrationParamsSchema
>;

export const AbortAgentMigrationResponseSchema = z.object({
  success: z.boolean(),
});

export type AbortAgentMigrationResponse = z.infer<
  typeof AbortAgentMigrationResponseSchema
>;

const abortAgentMigrationContract = c.mutation({
  method: 'POST',
  path: '/agent-templates/migrations/:workflowId/abort',
  pathParams: AbortAgentMigrationParamsSchema,
  body: z.undefined(),
  responses: {
    200: AbortAgentMigrationResponseSchema,
  },
});

export const ShortVersionedTemplateType = z.object({
  id: z.string(),
  version: z.string(),
  agentTemplateId: z.string(),
  message: z.string().optional(),
  createdAt: z.string(),
});

const listTemplateVersionsContract = c.query({
  method: 'GET',
  path: '/agent-templates/:agentTemplateId/versions',
  pathParams: z.object({
    agentTemplateId: z.string(),
  }),
  query: ListTemplateVersionsQuerySchema,
  responses: {
    200: z.object({
      versions: z.array(ShortVersionedTemplateType),
      hasNextPage: z.boolean(),
    }),
  },
});

const importAgentFileAsTemplateContract = c.mutation({
  method: 'POST',
  contentType: 'multipart/form-data',
  path: '/agent-template/import',
  body: c.type<{
    file: File;
  }>(),
  query: zodTypes.post_Import_agent_serialized.parameters.shape.query,
  responses: {
    201: z.object({
      name: z.string(),
      id: z.string(),
    }),
  },
});

const updateTemplateNameContract = c.mutation({
  method: 'PATCH',
  path: '/agent-templates/:agentTemplateId/name',
  pathParams: z.object({
    agentTemplateId: z.string(),
  }),
  body: z.object({
    name: z
      .string()
      .min(3, {
        message: 'Name must be at least 3 characters long',
      })
      .max(50, {
        message: 'Name must be at most 50 characters long',
      })
      .regex(/^[a-zA-Z0-9_-]+$/, {
        message: 'Name must be alphanumeric with underscores or dashes',
      }),
  }),
  responses: {
    200: AgentTemplateSchema,
  },
});

export const agentTemplatesContracts = c.router({
  listAgentTemplates: listAgentTemplatesContract,
  forkAgentTemplate: forkAgentTemplateContract,
  getAgentTemplateByVersion: getAgentTemplateByVersionContract,
  getAgentTemplateById: getAgentTemplateByIdContract,
  getDeployedAgentTemplateById: getDeployedAgentTemplateByIdContract,
  listTemplateVersions: listTemplateVersionsContract,
  listAgentMigrations: listAgentMigrationsContract,
  importAgentFileAsTemplate: importAgentFileAsTemplateContract,
  abortAgentMigration: abortAgentMigrationContract,
  updateTemplateName: updateTemplateNameContract,
});

export const agentTemplatesQueryClientKeys = {
  listAgentTemplates: ['listAgentTemplates'],
  listAgentTemplatesWithSearch: (query: ListAgentTemplatesQuery) => [
    ...agentTemplatesQueryClientKeys.listAgentTemplates,
    query,
  ],
  getAgentTemplateSession: (params: GetAgentTemplateSessionParams) => [
    'getAgentTemplateSession',
    params,
  ],
  getAgentTemplateByVersion: (slug: string) => [
    'getAgentTemplateByVersion',
    { slug },
  ],
  getAgentTemplateById: (id: string) => ['getAgentTemplateById', { id }],
  getDeployedAgentTemplateById: (id: string) => [
    'getDeployedAgentTemplateById',
    { id },
  ],
  listTemplateVersions: (agentTemplateId: string) => [
    'listTemplateVersions',
    { agentTemplateId },
  ],
  listTemplateVersionsWithSearch: (
    agentTemplateId: string,
    query: ListTemplateVersionsQuery,
  ) => [
    ...agentTemplatesQueryClientKeys.listTemplateVersions(agentTemplateId),
    query,
  ],
  listAgentMigrations: (params: { templateName: string }) => [
    'listAgentMigrations',
    params,
  ],
  listAgentMigrationsWithSearch: (params: ListAgentMigrationsQuery) => [
    ...agentTemplatesQueryClientKeys.listAgentMigrations(params),
    params,
  ],
  abortAgentMigration: (workflowId: string) => [
    'abortAgentMigration',
    { workflowId },
  ],
};
