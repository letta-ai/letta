import {
  pgTable,
  text,
  pgEnum,
  timestamp,
  boolean,
  bigint,
  uniqueIndex,
  json,
  serial,
  numeric,
} from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';
import type {
  GenericPanelTemplateId,
  PanelItemPositionsMatrix,
} from '@letta-web/component-library';

export const emailWhitelist = pgTable('email_whitelist', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const organizations = pgTable('organizations', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  lettaAgentsId: text('letta_agents_id').notNull().unique(),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const orgRelationsTable = relations(organizations, ({ many }) => ({
  users: many(users),
  apiKeys: many(lettaAPIKeys),
  projects: many(projects),
  testingAgents: many(agentTemplates),
  sourceAgents: many(deployedAgentTemplates),
  deployedAgents: many(deployedAgents),
}));

export const organizationPreferences = pgTable('organization_preferences', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  catchAllAgentsProjectId: text('catch_all_agents_project_id'),
});

export const organizationPreferencesRelations = relations(
  organizationPreferences,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationPreferences.organizationId],
      references: [organizations.id],
    }),
    catchAllAgentsProject: one(projects, {
      fields: [organizationPreferences.catchAllAgentsProjectId],
      references: [projects.id],
    }),
  })
);

export const signupMethodsEnum = pgEnum('signup_methods', ['google', 'email']);

export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  providerId: text('provider_id').unique(),
  signupMethod: signupMethodsEnum('signup_method').notNull(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  imageUrl: text('image_url').notNull(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  lettaAgentsId: text('letta_agents_id').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const userRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
}));

export const lettaAPIKeys = pgTable('letta_api_keys', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  apiKey: text('api_key').notNull().unique(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const lettaAgentsAPIKeyRelations = relations(
  lettaAPIKeys,
  ({ one }) => ({
    user: one(users, {
      fields: [lettaAPIKeys.userId],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [lettaAPIKeys.organizationId],
      references: [organizations.id],
    }),
  })
);

export const projects = pgTable(
  'projects',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    unique: {
      uniqueSlug: uniqueIndex('unique_slug').on(
        table.slug,
        table.organizationId
      ),
    },
  })
);

export const projectRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  deployedAgentTemplates: many(deployedAgentTemplates),
  agentTemplates: many(agentTemplates),
  deployedAgents: many(deployedAgents),
}));

export const agentTemplates = pgTable(
  'agent_templates',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    projectId: text('project_id').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    unique: {
      uniqueName: uniqueIndex('unique_name').on(
        table.name,
        table.organizationId
      ),
    },
  })
);

export const agentTemplateRelations = relations(
  agentTemplates,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [agentTemplates.organizationId],
      references: [organizations.id],
    }),
    project: one(projects, {
      fields: [agentTemplates.projectId],
      references: [projects.id],
    }),
    deployedAgentTemplates: many(deployedAgentTemplates),
    agentSimulatorSessions: many(agentSimulatorSessions),
  })
);

export const deployedAgentTemplates = pgTable(
  'deployed_agent_templates',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    projectId: text('project_id').notNull(),
    agentTemplateId: text('agent_template_id').notNull(),
    version: text('version').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    unique: {
      uniqueVersion: uniqueIndex('unique_version').on(
        table.version,
        table.organizationId,
        table.agentTemplateId
      ),
    },
  })
);

export const deployedAgentTemplatesRelations = relations(
  deployedAgentTemplates,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [deployedAgentTemplates.organizationId],
      references: [organizations.id],
    }),
    agentTemplate: one(agentTemplates, {
      fields: [deployedAgentTemplates.agentTemplateId],
      references: [agentTemplates.id],
    }),
    deployedAgents: many(deployedAgents),
    project: one(projects, {
      fields: [deployedAgentTemplates.projectId],
      references: [projects.id],
    }),
  })
);

export const deployedAgents = pgTable(
  'deployed_agents',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull(),
    deployedAgentTemplateId: text('deployed_agent_template_id'),
    projectId: text('project_id').notNull(),
    internalAgentCountId: bigint('internal_agent_count_id', { mode: 'number' })
      .notNull()
      .default(0),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    unique: {
      uniqueKey: uniqueIndex('unique_key').on(
        table.key,
        table.organizationId,
        table.projectId
      ),
    },
  })
);

export const deployedAgentRelations = relations(deployedAgents, ({ one }) => ({
  organization: one(organizations, {
    fields: [deployedAgents.organizationId],
    references: [organizations.id],
  }),
  deployedAgentTemplate: one(deployedAgentTemplates, {
    fields: [deployedAgents.deployedAgentTemplateId],
    references: [deployedAgentTemplates.id],
  }),
  project: one(projects, {
    fields: [deployedAgents.projectId],
    references: [projects.id],
  }),
}));

export const agentSimulatorSessions = pgTable('agent_simulator_sessions', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  agentId: text('agent_id').notNull(),
  agentTemplateId: text('agent_template_id').notNull(),
  variables: json('variables').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const agentSimulatorSessionRelations = relations(
  agentSimulatorSessions,
  ({ many }) => ({
    agentTemplates: many(agentTemplates),
  })
);

export const adePreferences = pgTable(
  'ade_preferences',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    agentId: text('agent_id'),
    displayConfig: json('display_config')
      .$type<PanelItemPositionsMatrix<GenericPanelTemplateId>>()
      .notNull(),
  },
  (table) => ({
    unique: {
      uniqueUserAgent: uniqueIndex('unique_user_agent').on(
        table.userId,
        table.agentId
      ),
    },
  })
);

export const adePreferencesRelations = relations(adePreferences, ({ one }) => ({
  user: one(users, {
    fields: [adePreferences.userId],
    references: [users.id],
  }),
}));

export const inferenceTransactions = pgTable('inference_transactions', {
  id: text('id')
    .notNull()
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  referenceId: text('reference_id').notNull(),
  agentId: text('agent_id').notNull(),
  organizationId: text('organization_id').notNull(),
  inputTokens: numeric('input_tokens').notNull(),
  outputTokens: numeric('output_tokens').notNull(),
  totalTokens: numeric('total_tokens').notNull(),
  stepCount: numeric('step_count').notNull(),
  providerType: text('providerType').notNull(),
  providerEndpoint: text('providerEndpoint').notNull(),
  providerModel: text('providerModel').notNull(),
  startedAt: timestamp('started_at').notNull(),
  endedAt: timestamp('ended_at').notNull(),
});

export const inferenceTransactionRelations = relations(
  inferenceTransactions,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [inferenceTransactions.organizationId],
      references: [organizations.id],
    }),
  })
);
