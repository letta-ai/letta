import {
  pgTable,
  uuid,
  text,
  pgEnum,
  timestamp,
  boolean,
} from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';

export const emailWhitelist = pgTable('email_whitelist', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const organizations = pgTable('organizations', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
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
  testingAgents: many(testingAgents),
  sourceAgents: many(sourceAgents),
  deployedAgents: many(deployedAgents),
}));

export const signupMethodsEnum = pgEnum('signup_methods', ['google', 'email']);

export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  providerId: text('provider_id').unique(),
  signupMethod: signupMethodsEnum('signup_method').notNull(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  imageUrl: text('image_url').notNull(),
  organizationId: uuid('organization_id')
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
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  apiKey: text('api_key').notNull().unique(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  organizationId: uuid('organization_id')
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

export const projects = pgTable('projects', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const projectRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  sourceAgents: many(sourceAgents),
  testingAgents: many(testingAgents),
  deployedAgents: many(deployedAgents),
}));

export const testingAgents = pgTable('testing_agents', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  agentId: text('agent_id').notNull().unique(),
  name: text('name').notNull(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  projectId: uuid('project_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const testingAgentRelations = relations(
  testingAgents,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [testingAgents.organizationId],
      references: [organizations.id],
    }),
    project: one(projects, {
      fields: [testingAgents.projectId],
      references: [projects.id],
    }),
    sourceAgents: many(sourceAgents),
  })
);

export const sourceAgentsStatusEnum = pgEnum('source_agents_enum', [
  'live',
  'offline',
]);

export const sourceAgents = pgTable('source_agents', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  projectId: uuid('project_id').notNull(),
  testingAgentId: text('testing_agent_id').notNull(),
  agentId: text('agent_id').notNull().unique(),
  version: text('version').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const sourceAgentRelations = relations(
  sourceAgents,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [sourceAgents.organizationId],
      references: [organizations.id],
    }),
    testingAgent: one(testingAgents, {
      fields: [sourceAgents.testingAgentId],
      references: [testingAgents.agentId],
    }),
    deployedAgents: many(deployedAgents),
    project: one(projects, {
      fields: [sourceAgents.projectId],
      references: [projects.id],
    }),
    status: one(sourceAgentsStatus, {
      fields: [sourceAgents.id],
      references: [sourceAgentsStatus.id],
    }),
  })
);

export const sourceAgentsStatus = pgTable('source_agent_status_table', {
  id: uuid('id').primaryKey(),
  status: sourceAgentsStatusEnum('status').notNull(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const sourceAgentsStatusRelation = relations(
  sourceAgentsStatus,
  ({ one }) => ({
    sourceAgent: one(sourceAgents, {
      fields: [sourceAgentsStatus.id],
      references: [sourceAgents.id],
    }),
  })
);

export const deployedAgents = pgTable('deployed_agents', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  sourceAgentId: uuid('source_agent_id').notNull(),
  projectId: uuid('project_id').notNull(),
  agentId: text('agent_id').notNull().unique(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const deployedAgentRelations = relations(deployedAgents, ({ one }) => ({
  organization: one(organizations, {
    fields: [deployedAgents.organizationId],
    references: [organizations.id],
  }),
  sourceAgent: one(sourceAgents, {
    fields: [deployedAgents.sourceAgentId],
    references: [sourceAgents.id],
  }),
  project: one(projects, {
    fields: [deployedAgents.projectId],
    references: [projects.id],
  }),
}));
