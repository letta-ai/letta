import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type {
  contracts,
  updateActiveOrganizationContract,
  userContract,
} from '$web/web-api/contracts';
import { deleteUser, getUser } from '$web/server/auth';
import {
  db,
  organizations,
  organizationUsers,
  userMarketingDetails,
  users,
} from '@letta-cloud/database';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { CookieNames } from '$web/server/cookies/types';
import { AdminService } from '@letta-cloud/letta-agents-api';
import { createOrUpdateCRMContact } from '@letta-cloud/crm';
import * as Sentry from '@sentry/node';
import { environment } from '@letta-cloud/environmental-variables';
import { trackServerSideEvent } from '@letta-cloud/analytics/server';
import { AnalyticsEvent } from '@letta-cloud/analytics';

type ResponseShapes = ServerInferResponses<typeof userContract>;

async function getCurrentUser(): Promise<ResponseShapes['getCurrentUser']> {
  const user = await getUser();

  if (!user) {
    return {
      status: 401,
      body: {
        message: 'User not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      theme: user.theme,
      name: user.name,
      email: user.email,
      locale: user.locale,
      imageUrl: user.imageUrl,
      permissions: Array.from(user.permissions),
      hasCloudAccess: user.hasCloudAccess,
      hasOnboarded: user.hasOnboarded,
      activeOrganizationId: user.activeOrganizationId || '',
      id: user.id,
    },
  };
}

type UpdateUserResponse = ServerInferResponses<
  typeof contracts.user.updateCurrentUser
>;
type UpdateUserPayload = ServerInferRequest<
  typeof contracts.user.updateCurrentUser
>;

async function updateCurrentUser(
  payload: UpdateUserPayload,
): Promise<UpdateUserResponse> {
  const user = await getUser();

  if (!user) {
    return {
      status: 401,
      body: {
        message: 'User not found',
      },
    };
  }

  if (payload.body.theme) {
    (await cookies()).set(CookieNames.THEME, payload.body.theme);
  }

  if (payload.body.locale) {
    (await cookies()).set(CookieNames.LOCALE, payload.body.locale);
  }

  const updatedUser = {
    ...user,
    ...payload.body,
  };

  await db
    .update(users)
    .set({
      name: updatedUser.name,
      theme: updatedUser.theme,
      locale: updatedUser.locale,
    })
    .where(eq(users.id, user.id));

  return {
    status: 200,
    body: {
      theme: updatedUser.theme,
      name: updatedUser.name,
      hasOnboarded: updatedUser.hasOnboarded,
      locale: updatedUser.locale,
      email: updatedUser.email,
      permissions: Array.from(user.permissions),
      hasCloudAccess: user.hasCloudAccess,
      imageUrl: updatedUser.imageUrl,
      activeOrganizationId: updatedUser.activeOrganizationId || '',
      id: updatedUser.id,
    },
  };
}

type ListUserOrganizationsResponse = ServerInferResponses<
  typeof contracts.user.listUserOrganizations
>;

async function listUserOrganizations(): Promise<ListUserOrganizationsResponse> {
  const user = await getUser();

  if (!user) {
    return {
      status: 401,
      body: {
        message: 'User not found',
      },
    };
  }

  const organizationsMapResponse = await db.query.organizationUsers.findMany({
    where: and(eq(organizationUsers.userId, user.id)),
  });

  const organizationsResponse = await db.query.organizations.findMany({
    where: and(
      inArray(
        organizations.id,
        organizationsMapResponse.map((o) => o.organizationId),
      ),
      isNull(organizations.deletedAt),
    ),
  });

  return {
    status: 200,
    body: {
      organizations: organizationsResponse.map((organization) => ({
        id: organization.id,
        name: organization.name,
      })),
    },
  };
}

type UpdateActiveOrganizationResponse = ServerInferResponses<
  typeof updateActiveOrganizationContract
>;

type UpdateActiveOrganizationRequest = ServerInferRequest<
  typeof updateActiveOrganizationContract
>;

async function updateActiveOrganization(
  request: UpdateActiveOrganizationRequest,
): Promise<UpdateActiveOrganizationResponse> {
  const user = await getUser();

  if (!user) {
    return {
      status: 401,
      body: {
        message: 'User not found',
      },
    };
  }

  const { activeOrganizationId } = request.body;

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, activeOrganizationId),
  });

  if (!organization) {
    return {
      status: 404,
      body: {
        message: 'Organization not found',
      },
    };
  }

  await Promise.all([
    db.update(users).set({ activeOrganizationId }).where(eq(users.id, user.id)),
    AdminService.updateUser({
      requestBody: {
        id: user.lettaAgentsId,
        organization_id: organization.lettaAgentsId,
      },
    }),
  ]);

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type DeleteUserResponse = ServerInferResponses<
  typeof userContract.deleteCurrentUser
>;

async function deleteCurrentUser(): Promise<DeleteUserResponse> {
  const user = await getUser();

  if (!user) {
    return {
      status: 401,
      body: {
        message: 'User not found',
      },
    };
  }

  await deleteUser(user.id);

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type SetUserAsOnboardedResponse = ServerInferResponses<
  typeof contracts.user.setUserAsOnboarded
>;

type SetUserAsOnboardedRequest = ServerInferRequest<
  typeof contracts.user.setUserAsOnboarded
>;

async function setUserAsOnboarded(
  req: SetUserAsOnboardedRequest,
): Promise<SetUserAsOnboardedResponse> {
  const user = await getUser();

  const { emailConsent, useCases, reasons } = req.body;

  if (!user) {
    return {
      status: 401,
      body: {
        message: 'User not found',
      },
    };
  }

  // check if marketing details already exist
  const marketingDetails = await db.query.userMarketingDetails.findFirst({
    where: eq(userMarketingDetails.userId, user.id),
  });

  await db
    .update(users)
    .set({ submittedOnboardingAt: new Date() })
    .where(eq(users.id, user.id));

  if (!marketingDetails) {
    const userMarketingDetailsPayload = {
      userId: user.id,
      consentedToEmailsAt: emailConsent ? new Date() : null,
      useCases,
      reasons,
    };

    await db.insert(userMarketingDetails).values(userMarketingDetailsPayload);
  } else {
    await db
      .update(userMarketingDetails)
      .set({
        consentedToEmailsAt: emailConsent ? new Date() : null,
        useCases,
        reasons,
      })
      .where(eq(userMarketingDetails.userId, user.id));
  }

  if (environment.HUBSPOT_API_KEY) {
    void createOrUpdateCRMContact({
      email: user.email,
      firstName: user.name.split(' ')[0],
      lastName: user.name.split(' ')[1],
      consentedToEmailMarketing: emailConsent,
      reasonsForUsingLetta: reasons,
      usesLettaFor: useCases,
    })
      .then(async (res) => {
        await db
          .update(userMarketingDetails)
          .set({ hubSpotContactId: res.id })
          .where(eq(userMarketingDetails.userId, user.id));

        trackServerSideEvent(AnalyticsEvent.ANSWERED_ONBOARDING_SURVEY, {
          consentedToEmailMarketing: !!emailConsent,
          reasonsForUsingLetta: reasons,
          usecasesForUsingLetta: useCases,
          userId: user.id,
        });
      })
      .catch((e) => {
        console.error('Error updating CRM contact', e);
        Sentry.captureException(e);
      });
  }

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

export const userRouter = {
  getCurrentUser,
  updateCurrentUser,
  listUserOrganizations,
  updateActiveOrganization,
  setUserAsOnboarded,
  deleteCurrentUser,
};
