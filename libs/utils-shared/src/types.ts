// Export additional types for better type safety
import { z } from 'zod';
import type { AgentTemplateStateWithNoMetadata } from './lib/synchronizeSimulatedAgentWithAgentTemplate/synchronizeSimulatedAgentWithAgentTemplate';
import type { ToZod } from '@letta-cloud/utils-types';
import {
  AgentTemplateProperties,
  GroupConfigurationSchema,
  LettaTemplateTypes,
} from '@letta-cloud/sdk-core';
import {
  MemoryVariableVersionOne,
  ToolRulesSchema,
  VariableStoreVersionOne,
  VariableStoreVersionOneType
} from '@letta-cloud/types';

// Agent Template Schema Types
export const BlockTemplateSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  limit: z.number(),
  description: z.string(),
  preserveOnMigration: z.boolean().nullable(),
  readOnly: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

type AgentTemplateStateToolRuleFix = Omit<
  AgentTemplateStateWithNoMetadata,
  'toolRules'
>;

/* there's a "bug" with ToZod that doesnt accept any types */
const AgentTemplateSchemaResponseSchemaBase: ToZod<AgentTemplateStateToolRuleFix> =
  z.object({
    model: z.string(),
    systemPrompt: z.string(),
    toolIds: z.array(z.string()).nullable(),
    sourceIds: z.array(z.string()).nullable(),
    properties: AgentTemplateProperties.nullable(),
    memoryVariables: VariableStoreVersionOne.nullable(),
    toolVariables: VariableStoreVersionOne.nullable(),
    tags: z.array(z.string()).nullable(),
    identityIds: z.array(z.string()).nullable(),
  });

export const AgentTemplateState = AgentTemplateSchemaResponseSchemaBase.extend({
  toolRules: ToolRulesSchema,
});

export const AgentTemplateSchemaResponseSchema = AgentTemplateState.extend({
  id: z.string(),
  lettaTemplateId: z.string(),
  organizationId: z.string(),
  entityId: z.string(),
  name: z.string(),
  projectId: z.string(),
  memoryVariables: VariableStoreVersionOne.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export function removeMetadataFromAgentTemplateResponse(
  agentTemplate: z.infer<typeof AgentTemplateSchemaResponseSchema>,
): AgentTemplateStateType {
  const {
    createdAt,
    entityId,
    id,
    lettaTemplateId,
    name,
    organizationId,
    projectId,
    updatedAt,
    ...rest
  } = agentTemplate;

  return rest;
}




export type AgentTemplateStateType = z.infer<typeof AgentTemplateState>;

export type BlockTemplate = z.infer<typeof BlockTemplateSchema>;
export type AgentTemplateSchemaResponse = z.infer<
  typeof AgentTemplateSchemaResponseSchema
>;

const BlockTemplateNoMetaDataSchema = BlockTemplateSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BlockTemplateNoMetaData = z.infer<typeof BlockTemplateNoMetaDataSchema>;


export function removeMetadataFromBlockTemplate(
  blockTemplate: z.infer<typeof BlockTemplateSchema>,
): BlockTemplateNoMetaData {
  const { id, createdAt, updatedAt, ...rest } = blockTemplate;
  return rest;
}

export const TemplateSnapshotSchema = z.object({
  agents: z.array(
    AgentTemplateSchemaResponseSchema.omit({
      createdAt: true,
      updatedAt: true,
      id: true,
      organizationId: true,
      projectId: true,
      lettaTemplateId: true,
    }),
  ),
  blocks: z.array(
    BlockTemplateSchema.omit({
      id: true,
      createdAt: true,
      updatedAt: true,
    }),
  ),
  configuration: GroupConfigurationSchema,
  type: LettaTemplateTypes,
  version: z.string(),
});

export type TemplateSnapshotSchemaType = z.infer<typeof TemplateSnapshotSchema>;
