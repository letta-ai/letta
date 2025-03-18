import type { ServerInferResponses } from '@ts-rest/core';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { onboardingSteps } from '@letta-cloud/types';

const c = initContract();

export const OnboardingStepSchema = z.object({
  claimedSteps: onboardingSteps.array(),
  completedSteps: onboardingSteps.array(),
  currentStep: onboardingSteps.nullable(),
  pausedAt: z.string().nullable(),
});

export type OnboardingStepSchemaType = z.infer<typeof OnboardingStepSchema>;

export const PublicUserSchema = z.object({
  name: z.string(),
  email: z.string(),
  imageUrl: z.string(),
  permissions: z.string().array(),
  theme: z.string(),
  locale: z.string(),
  activeOrganizationId: z.string(),
  hasOnboarded: z.boolean(),
  hasCloudAccess: z.boolean(),
  onboardingStatus: OnboardingStepSchema.nullable(),
  id: z.string(),
});

export type PublicUserSchemaType = z.infer<typeof PublicUserSchema>;

export type GetUser200ResponseType = ServerInferResponses<
  typeof getUserContract,
  200
>;

const getUserContract = c.query({
  method: 'GET',
  path: '/user/self',
  responses: {
    200: PublicUserSchema,
  },
});

/* Update User */
export const UpdateUserPayloadSchema = z.object({
  name: z.string().optional(),
  theme: z.string().optional(),
  locale: z.string().optional(),
});

const updateCurrentUserContract = c.mutation({
  method: 'PUT',
  path: '/user/self',
  body: UpdateUserPayloadSchema,
  responses: {
    200: PublicUserSchema,
  },
});

/* List user organizations */
export const ListUserOrganizationsItemSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const ListUserOrganizationsResponseSchema = z.object({
  organizations: z.array(ListUserOrganizationsItemSchema),
});

export type ListUserOrganizationsItemSchemaType = z.infer<
  typeof ListUserOrganizationsItemSchema
>;

export type ListUserOrganizationsResponseSchemaType = z.infer<
  typeof ListUserOrganizationsResponseSchema
>;

export const listUserOrganizationsContract = c.query({
  method: 'GET',
  path: '/user/self/organizations',
  responses: {
    200: ListUserOrganizationsResponseSchema,
  },
});

/* Update active organization id */
export const UpdateActiveOrganizationPayloadSchema = z.object({
  activeOrganizationId: z.string(),
});

export const updateActiveOrganizationContract = c.mutation({
  method: 'PUT',
  path: '/user/self/active-organization',
  body: UpdateActiveOrganizationPayloadSchema,
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

/* Delete user */
export const deleteCurrentUserCurrent = c.mutation({
  method: 'DELETE',
  path: '/user/self',
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
  body: z.undefined(),
});

/* Set user as onboarded */
const OnboardingPayloadSchema = z.object({
  reasons: z.string().array(),
  useCases: z.string().array(),
  emailConsent: z.boolean(),
});

export const setUserAsOnboardedContract = c.mutation({
  method: 'POST',
  path: '/user/self/onboarded',
  body: OnboardingPayloadSchema,
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

const CreateUserWithPasswordSchema = z.object({
  name: z.string(),
  email: z.string(),
  password: z.string(),
  inviteCode: z.string(),
});

const createAccountWithPasswordContract = c.mutation({
  path: '/user/new',
  method: 'POST',
  body: CreateUserWithPasswordSchema,
  responses: {
    201: z.object({
      success: z.boolean(),
    }),
    400: z.object({
      errorCode: z.enum(['emailAlreadyTaken', 'invalidInviteCode']),
    }),
  },
});

const LoginWithPasswordSchema = z.object({
  email: z.string(),
  password: z.string(),
});

const loginWithPasswordContract = c.mutation({
  path: '/user/login',
  method: 'POST',
  body: LoginWithPasswordSchema,
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
    400: z.object({
      errorCode: z.enum(['invalidPassword']),
    }),
  },
});

const updateUserOnboardingStepContract = c.mutation({
  method: 'PUT',
  path: '/user/self/onboarding/claim',
  body: z.object({
    onboardingStep: onboardingSteps,
    stepToClaim: onboardingSteps.optional(),
  }),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

const PauseOnboardingContract = c.mutation({
  method: 'POST',
  path: '/user/self/onboarding/pause',
  body: z.undefined(),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

const UnpauseOnboardingContract = c.mutation({
  method: 'POST',
  path: '/user/self/onboarding/unpause',
  body: z.undefined(),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

export const userContract = c.router({
  getCurrentUser: getUserContract,
  updateCurrentUser: updateCurrentUserContract,
  listUserOrganizations: listUserOrganizationsContract,
  updateActiveOrganization: updateActiveOrganizationContract,
  deleteCurrentUser: deleteCurrentUserCurrent,
  setUserAsOnboarded: setUserAsOnboardedContract,
  createAccountWithPassword: createAccountWithPasswordContract,
  loginWithPassword: loginWithPasswordContract,
  updateUserOnboardingStep: updateUserOnboardingStepContract,
  pauseUserOnboarding: PauseOnboardingContract,
  unpauseUserOnboarding: UnpauseOnboardingContract,
});

export const userQueryClientKeys = {
  getCurrentUser: ['user', 'self'],
  listUserOrganizations: ['user', 'self', 'organizations'],
};
