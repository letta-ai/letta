import {
  pgTable,
  text,
  pgEnum,
  timestamp,
  boolean,
  uniqueIndex,
  json,
  numeric,
  primaryKey,
  unique,
  integer,
} from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';
import type {
  StepCostVersionOne,
  MemoryVariableVersionOneType,
  OnboardingStepsType,
  AccessPolicyVersionOneType,
  DatabaseBillingTiersType,
} from '@letta-cloud/types';
import type { ApplicationServices } from '@letta-cloud/service-rbac';
import type { UserPresetRolesType } from '@letta-cloud/service-rbac';
import type { DatasetItemCreateMessageType } from '@letta-cloud/sdk-core';

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
  deployedAgentsMetadata: many(deployedAgentMetadata),
  organizationUsers: many(organizationUsers),
  organizationPreferences: one(organizationPreferences, {
    fields: [organizations.id],
    references: [organizationPreferences.organizationId],
  }),
  organizationInvitedUsers: many(organizationInvitedUsers),
  organizationDevelopmentServers: many(developmentServers),
  organizationVerifiedDomains: many(organizationVerifiedDomains),
  organizationInviteRules: many(organizationInviteRules),
  organizationCredits: one(organizationCredits, {
    fields: [organizations.id],
    references: [organizationCredits.organizationId],
  }),
  organizationBillingDetails: one(organizationBillingDetails, {
    fields: [organizations.id],
    references: [organizationBillingDetails.organizationId],
  }),
  organizationCreditTransactions: many(organizationCreditTransactions),
  organizationSSOConfiguration: many(organizationSSOConfiguration),
  organizationClaimedOnboardingRewards: many(
    organizationClaimedOnboardingRewards,
    {
      relationName: 'claimedOnboardingRewards',
    },
  ),
  datasets: many(datasets),
}));

export const organizationClaimedOnboardingRewards = pgTable(
  'organization_claimed_onboarding_rewards',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: text('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    rewardKey: text('reward_key').notNull().$type<OnboardingStepsType>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    uniqueRewardKey: uniqueIndex('unique_reward_key').on(
      table.rewardKey,
      table.organizationId,
    ),
  }),
);

export const organizationClaimedOnboardingRewardsRelations = relations(
  organizationClaimedOnboardingRewards,
  ({ one }) => ({
    organization: one(organizations, {
      relationName: 'claimedOnboardingRewards',
      fields: [organizationClaimedOnboardingRewards.organizationId],
      references: [organizations.id],
    }),
  }),
);

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
  'workos-sso',
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
  verifiedAt: timestamp('verified_at'),
  submittedOnboardingAt: timestamp('submitted_onboarding_at'),
  deletedAt: timestamp('deleted_at'),
  bannedAt: timestamp('banned_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const verifiedEmail = pgTable('verified_email', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text('email').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const verifiedPhoneNumber = pgTable('verified_phone_number', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  phoneNumber: text('phone_number').notNull().unique(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const verifiedEmailRelations = relations(verifiedEmail, ({ one }) => ({
  user: one(users, {
    fields: [verifiedEmail.userId],
    references: [users.id],
  }),
}));

export const verifiedPhoneNumberRelations = relations(
  verifiedPhoneNumber,
  ({ one }) => ({
    user: one(users, {
      fields: [verifiedPhoneNumber.userId],
      references: [users.id],
    }),
  }),
);

export const userRelations = relations(users, ({ many, one }) => ({
  organizationUsers: many(organizationUsers),
  activeOrganization: one(organizations, {
    fields: [users.activeOrganizationId],
    references: [organizations.id],
  }),
  verifiedEmail: one(verifiedEmail, {
    fields: [users.id],
    references: [verifiedEmail.userId],
  }),
  verifiedPhoneNumber: one(verifiedPhoneNumber, {
    fields: [users.id],
    references: [verifiedPhoneNumber.userId],
  }),
  userMarketingDetails: one(userMarketingDetails, {
    fields: [users.id],
    references: [userMarketingDetails.userId],
  }),
  userPassword: one(userPassword, {
    fields: [users.id],
    references: [userPassword.userId],
  }),
  userProductOnboarding: one(userProductOnboarding, {
    fields: [users.id],
    references: [userProductOnboarding.userId],
  }),
}));

export const userProductOnboarding = pgTable('user_product_onboarding_step', {
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .primaryKey(),
  pausedAt: timestamp('paused_at'),
  completedSteps: json('completed_steps').$type<OnboardingStepsType[]>(),
  currentStep: text('current_step').$type<OnboardingStepsType>(),
});

export const userPassword = pgTable('user_password', {
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .primaryKey(),
  password: text('password').notNull(),
  salt: text('salt').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const userPasswordRelations = relations(userPassword, ({ one }) => ({
  user: one(users, {
    fields: [userPassword.userId],
    references: [users.id],
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
  deployedAgentsMetadata: many(deployedAgentMetadata),
  datasets: many(datasets),
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
    launchLinkConfiguration: one(launchLinkConfigurations, {
      fields: [agentTemplates.id],
      references: [launchLinkConfigurations.agentTemplateId],
    }),
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
    memoryVariables:
      json('memory_variables').$type<MemoryVariableVersionOneType>(),
    message: text('message'),
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
  ({ one }) => ({
    organization: one(organizations, {
      fields: [deployedAgentTemplates.organizationId],
      references: [organizations.id],
    }),
    agentTemplate: one(agentTemplates, {
      fields: [deployedAgentTemplates.agentTemplateId],
      references: [agentTemplates.id],
    }),
    project: one(projects, {
      fields: [deployedAgentTemplates.projectId],
      references: [projects.id],
    }),
  }),
);

export const deployedAgentVariables = pgTable('deployed_agent_variables', {
  deployedAgentId: text('deployed_agent_id')
    .notNull()
    .primaryKey()
    .references(() => deployedAgentMetadata.agentId, { onDelete: 'cascade' }),
  organizationId: text('organization_id').notNull(),
  value: json('value').notNull().$type<Record<string, string>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const simulatedAgent = pgTable(
  'simulated_agent_real',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    agentId: text('agent_id').unique().notNull(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, {
        onDelete: 'cascade',
      }),
    organizationId: text('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    agentTemplateId: text('agent_template_id')
      .notNull()
      .references(() => agentTemplates.id, {
        onDelete: 'cascade',
      }),
    /* optional, if empty, it means it should use the latest version */
    deployedAgentTemplateId: text('deployed_agent_template_id').references(
      () => deployedAgentTemplates.id,
      {
        onDelete: 'cascade',
      },
    ),
    memoryVariables:
      json('memory_variables').$type<MemoryVariableVersionOneType>(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$onUpdate(() => new Date()),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (self) => ({
    // unique constraint on agentTemplateId + deployedAgentTemplateId + default
    uniqueDefault: uniqueIndex('unique_default_simulated_agent').on(
      self.agentTemplateId,
      self.deployedAgentTemplateId,
      self.isDefault,
    ),
  }),
);

export const simulatedAgentRelations = relations(simulatedAgent, ({ one }) => ({
  agentTemplate: one(agentTemplates, {
    fields: [simulatedAgent.agentTemplateId],
    references: [agentTemplates.id],
  }),
  deployedAgentTemplate: one(deployedAgentTemplates, {
    fields: [simulatedAgent.deployedAgentTemplateId],
    references: [deployedAgentTemplates.id],
  }),
  project: one(projects, {
    fields: [simulatedAgent.projectId],
    references: [projects.id],
  }),
  organization: one(organizations, {
    fields: [simulatedAgent.organizationId],
    references: [organizations.id],
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

export const modelTierEnum = pgEnum('model_tier_enum', [
  'free',
  'premium',
  'per-inference',
]);

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
    tier: modelTierEnum('tier').notNull(),
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
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    stepId: text('step_id').unique(),
    source: text('source').notNull(),
    modelId: text('model_id'),
    modelTier: modelTierEnum('model_tier_type'),
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
    billingTier: text('billing_tier').$type<DatabaseBillingTiersType | null>(),
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

export const organizationSSOConfiguration = pgTable(
  'organization_sso_configuration',
  {
    id: text('id')
      .notNull()
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: text('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    domain: text('domain').notNull().unique(),
    workOSOrganizationId: text('workos_organization_id').notNull(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$onUpdate(() => new Date()),
  },
);

export const organizationSSOConfigurationRelations = relations(
  organizationSSOConfiguration,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationSSOConfiguration.organizationId],
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
    launchLinkId: text('launch_link_id').references(
      () => launchLinkConfigurations.agentTemplateId,
      { onDelete: 'cascade' },
    ),
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
    launchLink: one(launchLinkConfigurations, {
      fields: [sharedAgentChatConfigurations.launchLinkId],
      references: [launchLinkConfigurations.agentTemplateId],
    }),
  }),
);

export const organizationLowBalanceNotificationLock = pgTable(
  'organization_low_balance_notification_lock',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' })
      .primaryKey(),
    lockId: text('lock_id').notNull(),
    lowBalanceNotificationSentAt: timestamp('low_balance_notification_sent_at'),
  },
);

export const launchLinkConfigurations = pgTable('launch_link_configurations', {
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  agentTemplateId: text('agent_template_id')
    .notNull()
    .primaryKey()
    .unique()
    .references(() => agentTemplates.id, {
      onDelete: 'cascade',
    }),
  accessLevel: chatAccessEnum('access_policy').notNull(),
  launchLink: text('launch_link').notNull().unique(),
});

export const launchLinkConfigurationsRelations = relations(
  launchLinkConfigurations,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [launchLinkConfigurations.organizationId],
      references: [organizations.id],
    }),
    agentTemplate: one(agentTemplates, {
      fields: [launchLinkConfigurations.agentTemplateId],
      references: [agentTemplates.id],
    }),
  }),
);

export const deployedAgentMetadata = pgTable('deployed_agent_metadata', {
  agentId: text('agent_id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, {
    onDelete: 'cascade',
  }),
});

export const deployedAgentsMetadataRelations = relations(
  deployedAgentMetadata,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [deployedAgentMetadata.organizationId],
      references: [organizations.id],
    }),
    project: one(projects, {
      fields: [deployedAgentMetadata.projectId],
      references: [projects.id],
    }),
    deployedAgentVariables: one(deployedAgentVariables, {
      fields: [deployedAgentMetadata.agentId],
      references: [deployedAgentVariables.deployedAgentId],
    }),
  }),
);

export const shareChatIdentity = pgTable('share_chat_identity', {
  identityId: text('identity_id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const shareChatUser = pgTable(
  'share_chat_user',
  {
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    chatId: text('chat_id')
      .notNull()
      .references(() => sharedAgentChatConfigurations.chatId, {
        onDelete: 'cascade',
      }),
    deployedAgentId: text('deployed_agent_id')
      .notNull()
      .references(() => deployedAgentMetadata.agentId, { onDelete: 'cascade' }),
    identityId: text('identity_id')
      .notNull()
      .references(() => shareChatIdentity.identityId, { onDelete: 'cascade' }),
    agentTemplateId: text('agent_template_id').references(
      () => agentTemplates.id,
      { onDelete: 'cascade' },
    ),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (self) => ({
    pk: primaryKey({
      columns: [self.userId, self.chatId, self.deployedAgentId],
    }),
  }),
);

export const shareChatUserRelations = relations(shareChatUser, ({ one }) => ({
  user: one(users, {
    fields: [shareChatUser.userId],
    references: [users.id],
  }),
  shareChatConfiguration: one(sharedAgentChatConfigurations, {
    fields: [shareChatUser.chatId],
    references: [sharedAgentChatConfigurations.agentId],
  }),
  deployedAgentMetadata: one(deployedAgentMetadata, {
    fields: [shareChatUser.deployedAgentId],
    references: [deployedAgentMetadata.agentId],
  }),
}));

export const clientSideAccessTokens = pgTable('client_side_access_tokens', {
  id: text('id')
    .notNull()
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: text('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  coreUserId: text('core_user_id').notNull(),
  requesterUserId: text('requester_user_id'),
  policy: json('policy').$type<AccessPolicyVersionOneType>().notNull(),
  hostname: text('host').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
});

export const clientSideAccessTokensRelations = relations(
  clientSideAccessTokens,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [clientSideAccessTokens.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const contentModerationViolations = pgTable(
  'content_moderation_violations',
  {
    id: text('id')
      .notNull()
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    reasons: json('violation_reasons').$type<{ data: string[] }>(),
    content: text('content').notNull(),
  },
);

export const contentModerationViolationsRelations = relations(
  contentModerationViolations,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [contentModerationViolations.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const activeAgents = pgTable('active_agents', {
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  agentId: text('agent_id').notNull().primaryKey(),
  lastActiveAt: timestamp('last_active_at').notNull().defaultNow(),
  isBilledAgent: boolean('is_billed_agent').notNull().default(false),
});

export const agentfilePermissionsEnum = pgEnum('agentfile_access_level', [
  'public',
  'organization',
  'logged-in',
  'unlisted',
  'none',
]);

export const agentfilePermissions = pgTable('agentfile_permissions', {
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  agentId: text('agent_id').notNull().primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  summary: text('summary').notNull(),
  accessLevel: agentfilePermissionsEnum('agentfile_access_level').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const agentfilePermissionsRelations = relations(
  agentfilePermissions,
  ({ one }) => ({
    agentfileStats: one(agentfileStats, {
      fields: [agentfilePermissions.agentId],
      references: [agentfileStats.agentId],
    }),
    organization: one(organizations, {
      fields: [agentfilePermissions.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const agentfileStats = pgTable('agentfile_stats', {
  agentId: text('agent_id').notNull().primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  totalDownloads: integer('total_downloads').notNull().default(0),
});

export const agentfileStatsRelations = relations(agentfileStats, ({ one }) => ({
  agentfilePermissions: one(agentfilePermissions, {
    fields: [agentfileStats.agentId],
    references: [agentfilePermissions.agentId],
  }),
}));

export const datasets = pgTable('datasets', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  description: text('description'),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const datasetRelations = relations(datasets, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [datasets.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [datasets.projectId],
    references: [projects.id],
  }),
  datasetItems: many(datasetItems),
}));

export const datasetItems = pgTable('dataset_items', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  datasetId: text('dataset_id')
    .notNull()
    .references(() => datasets.id, { onDelete: 'cascade' }),
  createMessage: json('create_message')
    .$type<DatasetItemCreateMessageType>()
    .notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const datasetItemRelations = relations(datasetItems, ({ one }) => ({
  dataset: one(datasets, {
    fields: [datasetItems.datasetId],
    references: [datasets.id],
  }),
}));

export const abTests = pgTable('ab_tests', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
});

export const abTestsRelations = relations(abTests, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [abTests.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [abTests.projectId],
    references: [projects.id],
  }),
  abTestTemplates: many(abTestAgentTemplates),
}));

export const abTestAgentTemplates = pgTable('ab_test_agent_templates', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  agentTemplateId: text('template_id').references(() => agentTemplates.id, {
    onDelete: 'cascade',
  }),
  deployedAgentTemplateId: text('deployed_agent_template_id').references(
    () => deployedAgentTemplates.id,
    {
      onDelete: 'cascade',
    },
  ),
  abTestId: text('ab_test_id')
    .notNull()
    .references(() => abTests.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  simulatedAgentId: text('simulated_agent_id')
    .notNull()
    .references(() => simulatedAgent.id, { onDelete: 'cascade' }),
});

// should be 1:1 with an agentTemplate
export const abTestAgentTemplatesRelations = relations(
  abTestAgentTemplates,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [abTestAgentTemplates.organizationId],
      references: [organizations.id],
    }),
    project: one(projects, {
      fields: [abTestAgentTemplates.projectId],
      references: [projects.id],
    }),
    abTest: one(abTests, {
      fields: [abTestAgentTemplates.abTestId],
      references: [abTests.id],
    }),
    deployedAgentTemplate: one(deployedAgentTemplates, {
      fields: [abTestAgentTemplates.deployedAgentTemplateId],
      references: [deployedAgentTemplates.id],
    }),
    agentTemplate: one(agentTemplates, {
      fields: [abTestAgentTemplates.agentTemplateId],
      references: [agentTemplates.id],
    }),
    simulatedAgent: one(simulatedAgent, {
      fields: [abTestAgentTemplates.simulatedAgentId],
      references: [simulatedAgent.id],
    }),
  }),
);
