import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type {
  contracts,
  updateActiveOrganizationContract,
  userContract,
} from '$web/web-api/contracts';
import {
  deleteUser,
  getUser,
  hashPassword,
  signInUserFromProviderLogin,
  signOutUser,
  verifyPassword,
} from '$web/server/auth';
import {
  db,
  organizationInvitedUsers,
  organizations,
  organizationUsers,
  userMarketingDetails,
  userPassword,
  userProductOnboarding,
  users,
  verifiedEmail,
  verifiedPhoneNumber,
} from '@letta-cloud/service-database';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { CookieNames } from '$web/server/cookies/types';
import { createOrUpdateCRMContact } from '@@letta-cloud/service-crm';
import * as Sentry from '@sentry/node';
import { environment } from '@letta-cloud/config-environment-variables';
import { trackServerSideEvent } from '@letta-cloud/service-analytics/server';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import {
  checkIfUserIsAllVerified,
  getTheUserVerifiedContacts,
  goToNextOnboardingStep,
} from '@letta-cloud/utils-server';
import { getRedisData, setRedisData } from '@letta-cloud/service-redis';
import { getCookie } from '$web/server/cookies';
import { getSingleFlag } from '@letta-cloud/service-feature-flags';
import { sendEmail } from '@letta-cloud/service-email';
import {
  sendSMSVerificationMessage,
  verifySMSVerificationMessage,
} from 'service-sms';
import { swapUserOrganization } from '$web/server/auth/lib/swapUserOrganization/swapUserOrganization';
import jwt from 'jsonwebtoken';
import { getCustomerSubscription } from '@letta-cloud/service-payments';

type GetIntercomTokenResponse = ServerInferResponses<
  typeof contracts.user.getIntercomToken
>;

async function getIntercomToken(): Promise<GetIntercomTokenResponse> {
  const user = await getUser();

  if (!user) {
    return {
      status: 401,
      body: {
        message: 'User not found',
      },
    };
  }
  if (!environment.INTERCOM_SECRET) {
    return {
      status: 200,
      body: {
        token: null,
      },
    };
  }

  const activeOrganizationId = user.activeOrganizationId || '';

  if (!activeOrganizationId) {
    return {
      status: 200,
      body: {
        token: null,
      },
    };
  }

  const [company, subscription] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(organizations.id, activeOrganizationId),
      columns: {
        name: true,
        createdAt: true,
      },
    }),
    getCustomerSubscription(activeOrganizationId),
  ]);

  if (!company || !subscription) {
    return {
      status: 200,
      body: {
        token: null,
      },
    };
  }

  const token = jwt.sign(
    {
      user_id: user.id,
      email: user.email,
      company: {
        company_id: user.activeOrganizationId || '',
        name: company.name,
        created_at: company.createdAt,
        plan: subscription.tier,
      },
    },
    environment.INTERCOM_SECRET,
    { expiresIn: '1h' },
  );

  return {
    status: 200,
    body: {
      token,
    },
  };
}

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
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      permissions: Array.from(user.permissions),
      hasCloudAccess: user.hasCloudAccess,
      hasOnboarded: user.hasOnboarded,
      onboardingStatus: user.onboardingStatus,
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

  const [ret] = await db
    .update(users)
    .set({
      name: updatedUser.name,
      theme: updatedUser.theme,
      locale: updatedUser.locale,
    })
    .where(eq(users.id, user.id))
    .returning();

  return {
    status: 200,
    body: {
      theme: updatedUser.theme,
      name: updatedUser.name,
      createdAt: ret.createdAt.toISOString(),
      hasOnboarded: updatedUser.hasOnboarded,
      locale: updatedUser.locale,
      isVerified: updatedUser.isVerified,
      email: updatedUser.email,
      permissions: Array.from(user.permissions),
      hasCloudAccess: user.hasCloudAccess,
      imageUrl: updatedUser.imageUrl,
      onboardingStatus: updatedUser.onboardingStatus,
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

  const session = await getCookie(CookieNames.LETTA_SESSION);

  if (!session) {
    return {
      status: 401,
      body: {
        message: 'User not found',
      },
    };
  }

  const userSession = await getRedisData('userSession', {
    sessionId: session.sessionId,
  });

  if (!userSession || !user) {
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

  await swapUserOrganization({
    userId: user.id,
    coreUserId: user.lettaAgentsId,
    organizationId: activeOrganizationId,
    coreOrganizationId: organization.lettaAgentsId,
  });

  await setRedisData(
    'userSession',
    { sessionId: session.sessionId },
    {
      expiresAt: Date.now() + 31536000000,
      data: {
        ...userSession,
        activeOrganizationId: activeOrganizationId,
      },
    },
  );

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

        void trackServerSideEvent(AnalyticsEvent.ANSWERED_ONBOARDING_SURVEY, {
          consented_to_email_marketing: !!emailConsent,
          reasons_for_using_letta: reasons,
          usecases_for_using_letta: useCases,
          user_id: user.id,
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

type CreateAccountWithPasswordAndInviteCodeResponse = ServerInferResponses<
  typeof contracts.user.createAccountWithPasswordAndInviteCode
>;

type CreateAccountWithPasswordAndInviteCodeRequest = ServerInferRequest<
  typeof contracts.user.createAccountWithPasswordAndInviteCode
>;

async function createAccountWithPasswordAndInviteCode(
  req: CreateAccountWithPasswordAndInviteCodeRequest,
): Promise<CreateAccountWithPasswordAndInviteCodeResponse> {
  const { email, password, name, inviteCode } = req.body;

  const invitedUserList = await db.query.organizationInvitedUsers.findFirst({
    where: and(
      eq(organizationInvitedUsers.email, email),
      eq(organizationInvitedUsers.inviteCode, inviteCode),
    ),
  });

  if (!invitedUserList) {
    return {
      status: 404,
      body: {
        errorCode: 'invalidInviteCode',
      },
    };
  }

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existingUser) {
    return {
      status: 400,
      body: {
        errorCode: 'emailAlreadyTaken',
      },
    };
  }

  const { isNewUser, user } = await signInUserFromProviderLogin({
    name,
    email,
    provider: 'email',
    isVerified: true,
    uniqueId: `${email}-password`,
    imageUrl: '',
    skipOnboarding: false,
  });

  if (!isNewUser) {
    await signOutUser();

    return {
      status: 400,
      body: {
        errorCode: 'emailAlreadyTaken',
      },
    };
  }

  const { hash, salt } = hashPassword(password);

  await db.insert(userPassword).values({
    userId: user.id,
    password: hash,
    salt,
  });

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type CreateAccountWithPasswordResponse = ServerInferResponses<
  typeof contracts.user.createAccountWithPassword
>;

type CreateAccountWithPasswordRequest = ServerInferRequest<
  typeof contracts.user.createAccountWithPassword
>;

async function createAccountWithPassword(
  req: CreateAccountWithPasswordRequest,
): Promise<CreateAccountWithPasswordResponse> {
  const { email, password, name } = req.body;

  const flag = await getSingleFlag('EMAIL_SIGNUP');

  if (!flag) {
    return {
      status: 401,
      body: {},
    };
  }

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existingUser) {
    return {
      status: 400,
      body: {
        errorCode: 'emailAlreadyTaken',
      },
    };
  }

  const { isNewUser, user } = await signInUserFromProviderLogin({
    name,
    email,
    provider: 'email',
    isVerified: false,
    uniqueId: `${email}-password`,
    imageUrl: '',
    skipOnboarding: false,
  });

  if (!isNewUser) {
    await signOutUser();

    return {
      status: 400,
      body: {
        errorCode: 'emailAlreadyTaken',
      },
    };
  }

  const { hash, salt } = hashPassword(password);

  await db.insert(userPassword).values({
    userId: user.id,
    password: hash,
    salt,
  });

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type LoginWithPasswordResponse = ServerInferResponses<
  typeof contracts.user.loginWithPassword
>;

type LoginWithPasswordRequest = ServerInferRequest<
  typeof contracts.user.loginWithPassword
>;

async function loginWithPassword(
  req: LoginWithPasswordRequest,
): Promise<LoginWithPasswordResponse> {
  const { email, password } = req.body;

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    return {
      status: 400,
      body: {
        errorCode: 'invalidPassword',
      },
    };
  }

  const userPasswordResponse = await db.query.userPassword.findFirst({
    where: eq(userPassword.userId, user.id),
  });

  if (!userPasswordResponse) {
    return {
      status: 400,
      body: {
        errorCode: 'invalidPassword',
      },
    };
  }

  const { password: hash, salt } = userPasswordResponse;

  if (!verifyPassword(password, salt, hash)) {
    return {
      status: 400,
      body: {
        errorCode: 'invalidPassword',
      },
    };
  }

  await signInUserFromProviderLogin({
    name: user.name,
    email: user.email,
    provider: 'email',
    isVerified: true,
    uniqueId: `${user.email}-password`,
    imageUrl: '',
    skipOnboarding: false,
  });

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type UpdateUserOnboardingStep = ServerInferResponses<
  typeof contracts.user.updateUserOnboardingStep
>;

type UpdateUserOnboardingStepRequest = ServerInferRequest<
  typeof contracts.user.updateUserOnboardingStep
>;

async function updateUserOnboardingStep(
  req: UpdateUserOnboardingStepRequest,
): Promise<UpdateUserOnboardingStep> {
  const { onboardingStep, stepToClaim } = req.body;

  const user = await getUser();

  if (!user?.activeOrganizationId) {
    return {
      status: 401,
      body: {
        message: 'User not found',
      },
    };
  }

  if (stepToClaim) {
    void trackServerSideEvent(AnalyticsEvent.MOVED_ONBOARDING_STEP, {
      step: stepToClaim,
      user_id: user.id,
    });
  }

  if (stepToClaim === 'completed') {
    void trackServerSideEvent(AnalyticsEvent.COMPLETED_ONBOARDING, {
      user_id: user.id,
    });
  }

  await goToNextOnboardingStep({
    userId: user.id,
    nextStep: onboardingStep,
    stepToClaim,
  });

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type StartForgetPasswordRequest = ServerInferRequest<
  typeof contracts.user.startForgotPassword
>;
type StartForgetPasswordResponse = ServerInferResponses<
  typeof contracts.user.startForgotPassword
>;

async function startForgotPassword(
  req: StartForgetPasswordRequest,
): Promise<StartForgetPasswordResponse> {
  const { email } = req.body;

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    return {
      status: 200,
      body: {
        success: true,
      },
    };
  }

  const existing = await getRedisData('forgotPassword', {
    email,
  });

  const currentTime = Date.now();
  if (existing && existing.canRetryAt > currentTime) {
    return {
      status: 200,
      body: {
        success: true,
      },
    };
  }

  // expires in 1 hour
  const expiresAt = Date.now() + 1000 * 60 * 60;
  const code = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, '0');
  const canRetryAt = Date.now() + 1000 * 60 * 1;

  await setRedisData(
    'forgotPassword',
    {
      email,
    },
    {
      data: {
        email,
        expiresAt,
        canRetryAt,
        code,
      },
    },
  );

  await sendEmail({
    to: email,
    type: 'forgotPassword',
    options: {
      locale: 'en',
      forgotPasswordUrl: `${process.env.NEXT_PUBLIC_CURRENT_HOST || ''}/reset-password?code=${code}&email=${encodeURIComponent(email)}`,
    },
  });

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type UpdatePasswordFromForgotPasswordResponse = ServerInferResponses<
  typeof contracts.user.updatePasswordFromForgotPassword
>;

type UpdatePasswordFromForgotPasswordRequest = ServerInferRequest<
  typeof contracts.user.updatePasswordFromForgotPassword
>;

async function updatePasswordFromForgotPassword(
  req: UpdatePasswordFromForgotPasswordRequest,
): Promise<UpdatePasswordFromForgotPasswordResponse> {
  const { email, code, password } = req.body;

  const existing = await getRedisData('forgotPassword', {
    email,
  });

  if (!existing || existing.code !== code) {
    return {
      status: 400,
      body: {
        errorCode: 'invalidCode',
      },
    };
  }

  if (existing.expiresAt < Date.now()) {
    return {
      status: 400,
      body: {
        errorCode: 'codeExpired',
      },
    };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    return {
      status: 400,
      body: {
        errorCode: 'codeExpired',
      },
    };
  }

  const { hash, salt } = hashPassword(password);

  await db
    .update(userPassword)
    .set({
      password: hash,
      salt,
    })
    .where(eq(userPassword.userId, user.id));

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type PauseUserOnboardingResponse = ServerInferResponses<
  typeof contracts.user.pauseUserOnboarding
>;

async function pauseUserOnboarding(): Promise<PauseUserOnboardingResponse> {
  const user = await getUser();

  if (!user) {
    return {
      status: 401,
      body: {
        message: 'User not found',
      },
    };
  }

  void trackServerSideEvent(AnalyticsEvent.PAUSED_ONBOARDING, {
    user_id: user.id,
  });

  await db
    .update(userProductOnboarding)
    .set({
      pausedAt: new Date(),
    })
    .where(eq(userProductOnboarding.userId, user.id));

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type UnpauseUserOnboardingResponse = ServerInferResponses<
  typeof contracts.user.unpauseUserOnboarding
>;

async function unpauseUserOnboarding(): Promise<UnpauseUserOnboardingResponse> {
  const user = await getUser();

  if (!user) {
    return {
      status: 401,
      body: {
        message: 'User not found',
      },
    };
  }

  await db
    .update(userProductOnboarding)
    .set({
      pausedAt: null,
    })
    .where(eq(userProductOnboarding.userId, user.id));

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type StartPhoneVerificationResponse = ServerInferResponses<
  typeof contracts.user.startPhoneVerification
>;

type StartPhoneVerificationRequest = ServerInferRequest<
  typeof contracts.user.startPhoneVerification
>;

function generate6DigitHexCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const ONE_HOUR_IN_MS = 60 * 60 * 1000;
const ONE_MINUTE_IN_MS = 60 * 1000;

async function startPhoneVerification(
  req: StartPhoneVerificationRequest,
): Promise<StartPhoneVerificationResponse> {
  const { phoneNumber } = req.body;

  const user = await getUser();

  if (!user) {
    return {
      status: 401,
      body: {
        message: 'User not found',
      },
    };
  }

  const currentTime = Date.now();
  const nextExpiration = currentTime + ONE_HOUR_IN_MS;
  const nextResendTime = currentTime + ONE_MINUTE_IN_MS;

  // get verified phone number
  const existingNumber = await db.query.verifiedPhoneNumber.findFirst({
    where: eq(verifiedPhoneNumber.userId, user.id),
  });

  if (existingNumber) {
    return {
      status: 400,
      body: {
        nextResendTime: '',
        errorCode: 'phoneAlreadyVerified',
      },
    };
  }

  // existing email verification code
  const existingPhoneTotp = await getRedisData('phoneTotp', {
    phone: phoneNumber,
  });

  // if the existing email verification code is 1 minute older than the next expiration, we can resend the email
  if (
    existingPhoneTotp &&
    existingPhoneTotp.expiresAt > nextExpiration - ONE_MINUTE_IN_MS
  ) {
    return {
      status: 400,
      body: {
        nextResendTime: new Date(
          existingPhoneTotp.expiresAt - ONE_HOUR_IN_MS + ONE_MINUTE_IN_MS,
        ).toISOString(),
        errorCode: 'tooEarly',
      },
    };
  }

  const code = generate6DigitHexCode();

  await setRedisData(
    'phoneTotp',
    {
      phone: phoneNumber,
    },
    {
      expiresAt: Date.now() + ONE_HOUR_IN_MS,
      data: {
        expiresAt: Date.now() + ONE_HOUR_IN_MS,
        code,
      },
    },
  );

  // send sms
  await sendSMSVerificationMessage({
    phoneNumber,
  });

  return {
    status: 200,
    body: {
      nextResendTime: new Date(nextResendTime).toISOString(),
      success: true,
    },
  };
}

type CompletePhoneVerificationResponse = ServerInferResponses<
  typeof contracts.user.completePhoneVerification
>;

type CompletePhoneVerificationRequest = ServerInferRequest<
  typeof contracts.user.completePhoneVerification
>;

async function completePhoneVerification(
  req: CompletePhoneVerificationRequest,
): Promise<CompletePhoneVerificationResponse> {
  const { verificationCode, phoneNumber } = req.body;

  const user = await getUser();

  if (!user) {
    return {
      status: 401,
      body: {
        message: 'User not found',
      },
    };
  }

  const phoneTotp = await getRedisData('phoneTotp', {
    phone: phoneNumber,
  });

  if (!phoneTotp) {
    return {
      status: 400,
      body: {
        errorCode: 'invalidVerificationCode',
      },
    };
  }

  const status = await verifySMSVerificationMessage({
    phoneNumber,
    code: verificationCode,
  });

  if (!status) {
    return {
      status: 400,
      body: {
        errorCode: 'invalidVerificationCode',
      },
    };
  }

  // if (phoneTotp.code !== verificationCode) {
  //   return {
  //     status: 400,
  //     body: {
  //       errorCode: 'invalidVerificationCode',
  //     },
  //   };
  // }

  await db.insert(verifiedPhoneNumber).values({
    userId: user.id,
    phoneNumber: phoneNumber,
  });

  const allVerified = await checkIfUserIsAllVerified(user.id);

  return {
    status: 200,
    body: {
      allVerified,
      success: true,
    },
  };
}

type StartEmailVerificationResponse = ServerInferResponses<
  typeof contracts.user.startEmailVerification
>;

async function startEmailVerification(): Promise<StartEmailVerificationResponse> {
  const user = await getUser();

  if (!user) {
    return {
      status: 401,
      body: {
        message: 'User not found',
      },
    };
  }

  // get verified email

  const existingEmail = await db.query.verifiedEmail.findFirst({
    where: eq(verifiedEmail.userId, user.id),
  });

  if (existingEmail) {
    return {
      status: 400,
      body: {
        errorCode: 'emailAlreadyVerified',
      },
    };
  }

  const currentTime = Date.now();
  const nextExpiration = currentTime + ONE_HOUR_IN_MS;
  const nextResendTime = currentTime + ONE_MINUTE_IN_MS;

  // existing email verification code
  const existingEmailTotp = await getRedisData('emailTotp', {
    email: user.email,
  });

  // if the existing email verification code is 1 minute older than the next expiration, we can resend the email
  if (
    existingEmailTotp &&
    existingEmailTotp.expiresAt > nextExpiration - 60000
  ) {
    return {
      status: 400,
      body: {
        errorCode: 'tooEarly',
      },
    };
  }

  const code = generate6DigitHexCode();

  await setRedisData(
    'emailTotp',
    {
      email: user.email,
    },
    {
      expiresAt: nextExpiration,
      data: {
        expiresAt: nextExpiration,
        code,
      },
    },
  );

  await sendEmail({
    to: user.email,
    type: 'verifyEmail',
    options: {
      locale: 'en',
      link: `${environment.NEXT_PUBLIC_CURRENT_HOST}/verify-email?code=${code}&email=${encodeURIComponent(user.email)}`,
    },
  });

  return {
    status: 200,
    body: {
      nextResendTime: new Date(nextResendTime).toISOString(),
      success: true,
    },
  };
}

type CompleteEmailVerificationResponse = ServerInferResponses<
  typeof contracts.user.completeEmailVerification
>;

type CompleteEmailVerificationRequest = ServerInferRequest<
  typeof contracts.user.completeEmailVerification
>;

async function completeEmailVerification(
  req: CompleteEmailVerificationRequest,
): Promise<CompleteEmailVerificationResponse> {
  const { verificationCode } = req.body;

  const user = await getUser();

  if (!user) {
    return {
      status: 401,
      body: {
        message: 'User not found',
      },
    };
  }

  const emailTotp = await getRedisData('emailTotp', {
    email: user.email,
  });

  if (!emailTotp) {
    return {
      status: 400,
      body: {
        errorCode: 'invalidVerificationCode',
      },
    };
  }

  if (emailTotp.code !== verificationCode) {
    return {
      status: 400,
      body: {
        errorCode: 'invalidVerificationCode',
      },
    };
  }

  await db.insert(verifiedEmail).values({
    userId: user.id,
    email: user.email,
  });

  const allVerified = await checkIfUserIsAllVerified(user.id);

  return {
    status: 200,
    body: {
      allVerified,
      success: true,
    },
  };
}

type GetUserVerifiedContacts = ServerInferResponses<
  typeof contracts.user.getUserVerifiedContacts
>;

async function getUserVerifiedContacts(): Promise<GetUserVerifiedContacts> {
  const user = await getUser();

  if (!user) {
    return {
      status: 401,
      body: {
        message: 'User not found',
      },
    };
  }

  const { verifiedPhone, verifiedEmail } = await getTheUserVerifiedContacts(
    user.id,
  );

  return {
    status: 200,
    body: {
      email: verifiedEmail || null,
      phone: verifiedPhone || null,
    },
  };
}

export const userRouter = {
  getCurrentUser,
  getIntercomToken,
  updateCurrentUser,
  listUserOrganizations,
  updateActiveOrganization,
  startForgotPassword,
  updatePasswordFromForgotPassword,
  setUserAsOnboarded,
  deleteCurrentUser,
  createAccountWithPassword,
  createAccountWithPasswordAndInviteCode,
  loginWithPassword,
  startEmailVerification,
  completeEmailVerification,
  updateUserOnboardingStep,
  pauseUserOnboarding,
  completePhoneVerification,
  unpauseUserOnboarding,
  startPhoneVerification,
  getUserVerifiedContacts,
};
