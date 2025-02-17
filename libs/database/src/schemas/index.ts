import {
  pgTable,
  text,
  pgEnum,
  timestamp,
  boolean,
  bigint,
  uniqueIndex,
  json,
  numeric,
  primaryKey,
  unique,
} from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';
import type {
  ProviderConfiguration,
  StepCostVersionOne,
} from '@letta-cloud/types';
import type { ApplicationServices } from '@letta-cloud/rbac';
import type { UserPresetRolesType } from '@letta-cloud/rbac';

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
  lettaServiceAccountId: text('letta_service_account_id'),
  isAdmin: boolean('is_admin').notNull().default(false),
  enabledCloudAt: timestamp('enabled_cloud_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
  bannedAt: timestamp('banned_at'),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const orgRelationsTable = relations(organizations, ({ many, one }) => ({
  apiKeys: many(lettaAPIKeys),
  projects: many(projects),
  testingAgents: many(agentTemplates),
  sourceAgents: many(deployedAgentTemplates),
  deployedAgents: many(deployedAgents),
  organizationUsers: many(organizationUsers),
  organizationPreferences: one(organizationPreferences, {
    fields: [organizations.id],
    references: [organizationPreferences.organizationId],
  }),
  organizationInvitedUsers: many(organizationInvitedUsers),
  organizationDevelopmentServers: many(developmentServers),
  organizationVerifiedDomains: many(organizationVerifiedDomains),
  organizationInviteRules: many(organizationInviteRules),
}));

export const organizationPreferences = pgTable('organization_preferences', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  defaultProjectId: text('default_project_id').notNull(),
});

export const organizationPreferencesRelations = relations(
  organizationPreferences,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationPreferences.organizationId],
      references: [organizations.id],
    }),
    catchAllAgentsProject: one(projects, {
      fields: [organizationPreferences.defaultProjectId],
      references: [projects.id],
    }),
  }),
);

export const signupMethodsEnum = pgEnum('signup_methods', [
  'google',
  'email',
  'github',
]);

export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  providerId: text('provider_id').unique(),
  signupMethod: signupMethodsEnum('signup_method').notNull(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  imageUrl: text('image_url').notNull(),
  activeOrganizationId: text('active_organization_id'),
  lettaAgentsId: text('letta_agents_id').notNull().unique(),
  theme: text('theme').default('auto'),
  locale: text('locale').default('en'),
  submittedOnboardingAt: timestamp('submitted_onboarding_at'),
  deletedAt: timestamp('deleted_at'),
  bannedAt: timestamp('banned_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const userRelations = relations(users, ({ many, one }) => ({
  organizationUsers: many(organizationUsers),
  activeOrganization: one(organizations, {
    fields: [users.activeOrganizationId],
    references: [organizations.id],
  }),
  userMarketingDetails: one(userMarketingDetails, {
    fields: [users.id],
    references: [userMarketingDetails.userId],
  }),
}));

export const userMarketingDetails = pgTable('user_marketing_details', {
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .primaryKey(),
  useCases: json('use_cases').$type<string[]>(),
  reasons: json('reasons').$type<string[]>(),
  hubSpotContactId: text('hubspot_contact_id'),
  consentedToEmailsAt: timestamp('consented_to_emails_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const userMarketingDetailsRelations = relations(
  userMarketingDetails,
  ({ one }) => ({
    user: one(users, {
      fields: [userMarketingDetails.userId],
      references: [users.id],
    }),
  }),
);

export interface OrganizationPermissionType {
  isOrganizationAdmin?: boolean;
}

export const organizationUsers = pgTable(
  'organization_users',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    customPermissions:
      json('custom_permissions').$type<ApplicationServices[]>(),
    role: text('role').$type<UserPresetRolesType>().notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.organizationId] }),
  }),
);

export const organizationUsersRelations = relations(
  organizationUsers,
  ({ one }) => ({
    user: one(users, {
      fields: [organizationUsers.userId],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [organizationUsers.organizationId],
      references: [organizations.id],
    }),
  }),
);

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
  coreUserId: text('core_user_id').notNull(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
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
  }),
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
    deletedAt: timestamp('deleted_at'),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    uniqueSlug: uniqueIndex('unique_slug').on(table.slug, table.organizationId),
  }),
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
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, {
        onDelete: 'cascade',
      }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    uniqueName: uniqueIndex('unique_name').on(table.name, table.organizationId),
  }),
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
  }),
);

export const deployedAgentTemplates = pgTable(
  'deployed_agent_templates',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, {
        onDelete: 'cascade',
      }),
    agentTemplateId: text('agent_template_id').notNull(),
    version: text('version').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    uniqueVersion: uniqueIndex('unique_version').on(
      table.version,
      table.organizationId,
      table.agentTemplateId,
    ),
  }),
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
  }),
);

export const deployedAgentVariables = pgTable('deployed_agent_variables', {
  deployedAgentId: text('deployed_agent_id').notNull().primaryKey(),
  organizationId: text('organization_id').notNull(),
  value: json('value').notNull().$type<Record<string, string>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const deployedAgents = pgTable(
  'deployed_agents',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull(),
    rootAgentTemplateId: text('root_agent_template_id'),
    deployedAgentTemplateId: text('deployed_agent_template_id'),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, {
        onDelete: 'cascade',
      }),
    internalAgentCountId: bigint('internal_agent_count_id', { mode: 'number' })
      .notNull()
      .default(0),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    migratedAt: timestamp('migrated_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    uniqueKey: uniqueIndex('unique_key').on(
      table.key,
      table.organizationId,
      table.projectId,
    ),
  }),
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
  rootAgentTemplate: one(agentTemplates, {
    fields: [deployedAgents.rootAgentTemplateId],
    references: [agentTemplates.id],
  }),
  deployedAgentVariables: one(deployedAgentVariables, {
    fields: [deployedAgents.id],
    references: [deployedAgentVariables.deployedAgentId],
  }),
}));

export const agentSimulatorSessions = pgTable('agent_simulator_sessions', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  agentId: text('agent_id').notNull(),
  agentTemplateId: text('agent_template_id')
    .notNull()
    .references(() => agentTemplates.id, {
      onDelete: 'cascade',
    })
    .unique(),
  organizationId: text('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  variables: json('variables').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const agentSimulatorSessionRelations = relations(
  agentSimulatorSessions,
  ({ one }) => ({
    agentTemplates: one(agentTemplates, {
      fields: [agentSimulatorSessions.agentTemplateId],
      references: [agentTemplates.id],
    }),
  }),
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
    displayConfig: json('display_config').$type().notNull(),
  },
  (table) => ({
    uniqueUserAgent: uniqueIndex('unique_user_agent').on(
      table.userId,
      table.agentId,
    ),
  }),
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
  projectId: text('project_id'),
  totalTokens: numeric('total_tokens').notNull(),
  stepCount: numeric('step_count').notNull(),
  providerType: text('providerType').notNull(),
  providerEndpoint: text('providerEndpoint').notNull(),
  providerModel: text('providerModel').notNull(),
  startedAt: timestamp('started_at').notNull(),
  endedAt: timestamp('ended_at').notNull(),
  source: text('source').notNull(),
});

export const inferenceTransactionRelations = relations(
  inferenceTransactions,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [inferenceTransactions.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const organizationInvitedUsers = pgTable(
  'organization_invites',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    email: text('email').notNull(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    inviteCode: text('invite_code').notNull().unique(),
    invitedBy: text('invited_by').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (self) => ({
    uniqueEmailIndex: uniqueIndex('unique_email').on(
      self.email,
      self.organizationId,
    ),
  }),
);

export const organizationInvitedUsersRelations = relations(
  organizationInvitedUsers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationInvitedUsers.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const developmentServers = pgTable('development_servers', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const developmentServerRelations = relations(
  developmentServers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [developmentServers.organizationId],
      references: [organizations.id],
    }),
    developmentServerPasswords: one(developmentServerPasswords, {
      fields: [developmentServers.id],
      references: [developmentServerPasswords.developmentServerId],
    }),
  }),
);

export const developmentServerPasswords = pgTable(
  'development_server_passwords',
  {
    developmentServerId: text('development_server_id')
      .references(() => developmentServers.id, { onDelete: 'cascade' })
      .notNull(),
    organizationId: text('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    password: text('password').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$onUpdate(() => new Date()),
  },
);

export const developmentServerPasswordRelations = relations(
  developmentServerPasswords,
  ({ one }) => ({
    developmentServer: one(developmentServers, {
      fields: [developmentServerPasswords.developmentServerId],
      references: [developmentServers.id],
    }),
    organization: one(organizations, {
      fields: [developmentServerPasswords.organizationId],
      references: [organizations.id],
    }),
  }),
);

const DEFAULT_INFERENCE_TOKENS_PER_MINUTE = '1000';
const DEFAULT_INFERENCE_REQUESTS_PER_MINUTE = '1000';

export const inferenceModelsMetadata = pgTable(
  'inference_models_metadata',
  {
    id: text('id')
      .notNull()
      .unique()
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    brand: text('brand').notNull(),
    isRecommended: boolean('is_recommended').notNull().default(false),
    tag: text('tag'),
    defaultContextWindow: numeric('default_context_window'),
    defaultRequestsPerMinutePerOrganization: numeric(
      'default_requests_per_minute_per_organization',
    )
      .default(DEFAULT_INFERENCE_REQUESTS_PER_MINUTE)
      .notNull(),
    defaultTokensPerMinutePerOrganization: numeric(
      'default_tokens_per_minute_per_organization',
    )
      .default(DEFAULT_INFERENCE_TOKENS_PER_MINUTE)
      .notNull(),
    modelName: text('model_name').notNull(),
    modelEndpoint: text('model_endpoint').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    disabledAt: timestamp('disabled_at'),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (self) => ({
    uniqueModelName: uniqueIndex('unique_inference_model_name').on(
      self.modelName,
      self.modelEndpoint,
    ),
  }),
);

export const inferenceModelRelations = relations(
  inferenceModelsMetadata,
  ({ many, one }) => ({
    perModelPerOrganizationRateLimitOverrides: many(
      perModelPerOrganizationRateLimitOverrides,
    ),
    stepCostSchema: one(stepCostSchemaTable, {
      fields: [inferenceModelsMetadata.id],
      references: [stepCostSchemaTable.modelId],
    }),
  }),
);

const DEFAULT_EMBEDDING_TOKENS_PER_MINUTE = '1000';
const DEFAULT_EMBEDDING_REQUESTS_PER_MINUTE = '1000';

export const embeddingModelsMetadata = pgTable(
  'embedding_models_metadata',
  {
    id: text('id')
      .notNull()
      .unique()
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    brand: text('brand').notNull(),
    modelName: text('model_name').notNull(),
    defaultRequestsPerMinutePerOrganization: numeric(
      'default_requests_per_minute_per_organization',
    )
      .default(DEFAULT_EMBEDDING_REQUESTS_PER_MINUTE)
      .notNull(),
    defaultTokensPerMinutePerOrganization: numeric(
      'default_tokens_per_minute_per_organization',
    )
      .default(DEFAULT_EMBEDDING_TOKENS_PER_MINUTE)
      .notNull(),
    modelEndpoint: text('model_endpoint').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    disabledAt: timestamp('disabled_at'),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (self) => ({
    uniqueModelName: uniqueIndex('unique_embedding_model_name').on(
      self.modelName,
      self.modelEndpoint,
    ),
  }),
);

export const toolMetadataProviderEnum = pgEnum('provider_enum', [
  'composio',
  'generic',
]);

export const toolMetadata = pgTable(
  'tool_metadata',
  {
    id: text('id')
      .notNull()
      .unique()
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    description: text('description').notNull(),
    brand: text('brand').notNull(),
    provider: toolMetadataProviderEnum('provider').notNull(),
    providerId: text('provider_id').notNull(),
    configuration: json('configuration').$type<ProviderConfiguration>(),
    tags: text('tags').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    disabledAt: timestamp('disabled_at'),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (self) => ({
    uniqueProviderId: uniqueIndex('unique_provider_id').on(
      self.provider,
      self.providerId,
    ),
  }),
);

export const toolGroupMetadata = pgTable('tool_group_metadata', {
  brand: text('brand').notNull().unique().primaryKey(),
  imageUrl: text('image_url'),
  description: text('description').notNull(),
});

export const organizationCredits = pgTable('organization_credits', {
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' })
    .primaryKey(),
  credits: numeric('credits').notNull().default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const organizationCreditsRelations = relations(
  organizationCredits,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationCredits.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const transactionTypesEnum = pgEnum('transaction_types', [
  'addition',
  'subtraction',
]);

export const organizationCreditTransactions = pgTable(
  'organization_credit_transactions',
  {
    id: text('id')
      .notNull()
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    source: text('source').notNull(),
    amount: numeric('amount').notNull(),
    transactionType: transactionTypesEnum('transaction_type').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
);

export const organizationCreditTransactionRelations = relations(
  organizationCreditTransactions,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationCreditTransactions.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const pricingModelEnum = pgEnum('pricing_model_enum', ['prepay', 'cpm']);

export const organizationBillingDetails = pgTable(
  'organization_billing_details',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' })
      .primaryKey(),
    stripeCustomerId: text('stripe_customer_id'),
    billingTier: text('billing_tier'),
    pricingModel: pricingModelEnum('pricing_model').notNull(),
    monthlyCreditAllocation: numeric('monthly_credit_allocation'),
  },
);

export const organizationBillingDetailsRelations = relations(
  organizationBillingDetails,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationBillingDetails.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const functionalMigrations = pgTable('functional_migrations', {
  singleId: text('single_id').notNull().primaryKey(),
  version: text('version').notNull(),
});

export const organizationBillingDetailsAudit = pgTable(
  'organization_billing_details_audit',
  {
    id: text('id')
      .notNull()
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    monthlyCreditAllocation: numeric('monthly_credit_allocation'),
    pricingModel: pricingModelEnum('pricing_model').notNull(),
    billingTier: text('billing_tier'),
    updatedBy: text('updated_by').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
);

export const perModelPerOrganizationRateLimitOverrides = pgTable(
  'per_model_per_organization_rate_limit_overrides',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' })
      .primaryKey(),
    modelId: text('model_id').notNull(),
    maxRequestsPerMinute: numeric('max_requests_per_minute').notNull(),
    maxTokensPerMinute: numeric('max_tokens_per_minute').notNull(),
  },
  (self) => ({
    uniqueModelId: uniqueIndex('unique_model_id').on(
      self.organizationId,
      self.modelId,
    ),
  }),
);

export const perModelPerOrganizationRateLimitOverridesRelations = relations(
  perModelPerOrganizationRateLimitOverrides,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [perModelPerOrganizationRateLimitOverrides.organizationId],
      references: [organizations.id],
    }),
    model: one(inferenceModelsMetadata, {
      fields: [perModelPerOrganizationRateLimitOverrides.modelId],
      references: [inferenceModelsMetadata.id],
    }),
  }),
);

export const stepCostSchemaTable = pgTable('step_cost_schema_by_model_id', {
  modelId: text('model_id')
    .notNull()
    .references(() => inferenceModelsMetadata.id, { onDelete: 'cascade' })
    .primaryKey(),
  stepCostSchema: json('step_cost_schema')
    .notNull()
    .$type<StepCostVersionOne>(),
});

export const stepCostSchemaByModelIdRelations = relations(
  stepCostSchemaTable,
  ({ one }) => ({
    model: one(inferenceModelsMetadata, {
      fields: [stepCostSchemaTable.modelId],
      references: [inferenceModelsMetadata.id],
    }),
  }),
);

export const stepCostSchemaAudit = pgTable('step_cost_schema_audit', {
  id: text('id')
    .notNull()
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  modelId: text('model_id')
    .notNull()
    .references(() => inferenceModelsMetadata.id, { onDelete: 'cascade' }),
  stepCostSchema: json('step_cost_schema')
    .notNull()
    .$type<StepCostVersionOne>(),
  updatedBy: text('updated_by').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const organizationVerifiedDomains = pgTable(
  'organization_verified_domains',
  {
    id: text('id')
      .notNull()
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: text('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    domain: text('domain').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (self) => ({
    uniqueDomain: unique().on(self.domain, self.organizationId),
  }),
);

export const organizationVerifiedDomainsRelations = relations(
  organizationVerifiedDomains,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationVerifiedDomains.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const organizationInviteRules = pgTable('organization_invite_rules', {
  id: text('id')
    .notNull()
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: text('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  verifiedDomain: text('verified_domain')
    .notNull()
    .references(() => organizationVerifiedDomains.id, { onDelete: 'cascade' }),
  role: text('role').notNull().$type<UserPresetRolesType>().notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const organizationInviteRulesRelations = relations(
  organizationInviteRules,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationInviteRules.organizationId],
      references: [organizations.id],
    }),
    domain: one(organizationVerifiedDomains, {
      fields: [organizationInviteRules.verifiedDomain],
      references: [organizationVerifiedDomains.id],
    }),
  }),
);

export const chatAccessEnum = pgEnum('chat_access', [
  'restricted',
  'organization',
  'logged-in',
  'everyone',
]);

export const sharedAgentChatConfigurations = pgTable(
  'shared_agent_chat_configurations',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    agentId: text('agent_id').notNull().unique().primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, {
        onDelete: 'cascade',
      }),
    accessLevel: chatAccessEnum('access_level').notNull(),
    chatId: text('access_url').notNull().unique(),
  },
);

export const sharedAgentChatConfigurationsRelations = relations(
  sharedAgentChatConfigurations,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [sharedAgentChatConfigurations.organizationId],
      references: [organizations.id],
    }),
    project: one(projects, {
      fields: [sharedAgentChatConfigurations.projectId],
      references: [projects.id],
    }),
  }),
);
