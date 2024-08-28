import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const orgsTable = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const orgRelationsTable = relations(orgsTable, ({ many }) => ({
  users: many(usersTable),
  apiKeys: many(lettaAgentsAPIKeyTable),
}));

export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  organizationId: serial('organization_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const userRelations = relations(usersTable, ({ one }) => ({
  organization: one(orgsTable, {
    fields: [usersTable.organizationId],
    references: [orgsTable.id],
  }),
}));

export const lettaAgentsAPIKeyTable = pgTable('letta_agents_api_keys', {
  id: serial('id').primaryKey(),
  apiKey: text('api_key').notNull().unique(),
  organizationId: serial('organization_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const lettaAgentsAPIKeyRelations = relations(
  lettaAgentsAPIKeyTable,
  ({ one }) => ({
    organization: one(orgsTable, {
      fields: [lettaAgentsAPIKeyTable.organizationId],
      references: [orgsTable.id],
    }),
  })
);
