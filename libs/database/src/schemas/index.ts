import { pgTable, uuid, text, pgEnum, timestamp } from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';

export const organizations = pgTable('organizations', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
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
  organizationId: uuid('organization_id').notNull(),
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
  apiKey: text('api_key').notNull().unique(),
  salt: text('salt').notNull(),
  organizationId: uuid('organization_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const lettaAgentsAPIKeyRelations = relations(
  lettaAPIKeys,
  ({ one }) => ({
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
  organizationId: uuid('organization_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const projectRelations = relations(projects, ({ one }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
}));

export const testingAgents = pgTable('testing_agents', {
  agentId: text('agent_id').primaryKey(),
  name: text('name').notNull(),
  organizationId: uuid('organization_id').notNull(),
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
    sourceAgents: many(sourceAgents),
  })
);

export const sourceAgents = pgTable('source_agents', {
  agentId: text('agent_id').primaryKey(),
  name: text('name').notNull(),
  organizationId: uuid('organization_id').notNull(),
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
      fields: [sourceAgents.agentId],
      references: [testingAgents.agentId],
    }),
    deployedAgents: many(deployedAgents),
  })
);

export const deployedAgents = pgTable('deployed_agents', {
  agentId: text('agent_id').primaryKey(),
  name: text('name').notNull(),
  organizationId: uuid('organization_id').notNull(),
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
    fields: [deployedAgents.agentId],
    references: [sourceAgents.agentId],
  }),
}));
