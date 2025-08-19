import {
  db,
  userProductOnboarding,
  users,
} from '@letta-cloud/service-database';
import { and, eq, isNull } from 'drizzle-orm';
import type { OnboardingStepsType } from '@letta-cloud/types';

interface GoToNextOnboardingStepOptions {
  userId: string;
  nextStep?: OnboardingStepsType | null;
  stepToClaim?: OnboardingStepsType;
}

export async function goToNextOnboardingStep(
  options: GoToNextOnboardingStepOptions,
) {
  const { userId, nextStep = null, stepToClaim } = options;

  const userFromDb = await db.query.users.findFirst({
    where: and(eq(users.id, userId), isNull(users.deletedAt)),
    with: {
      userProductOnboarding: {
        columns: {
          completedSteps: true,
          currentStep: true,
        },
      },
      activeOrganization: {
        columns: {
          enabledCloudAt: true,
        },
        with: {
          organizationClaimedOnboardingRewards: true,
        },
      },
    },
  });

  if (!userFromDb?.activeOrganizationId) {
    throw new Error(
      'User needs to be part of an active organization to claim a reward',
    );
  }

  const currentOnboardingSteps =
    userFromDb.userProductOnboarding?.completedSteps || [];

  const _claimedSteps =
    userFromDb.activeOrganization?.organizationClaimedOnboardingRewards?.map(
      (reward) => reward.rewardKey,
    ) || [];
  //
  // if (
  //   stepToClaim &&
  //   !claimedSteps.includes(stepToClaim) &&
  //   stepToRewardMap[stepToClaim]
  // ) {
  //   try {
  //     await db.insert(organizationClaimedOnboardingRewards).values({
  //       organizationId: userFromDb.activeOrganizationId,
  //       rewardKey: stepToClaim,
  //     });
  //
  //     await addCreditsToOrganization({
  //       organizationId: userFromDb.activeOrganizationId,
  //       note: `Claimed reward for ${stepToClaim}`,
  //       amount: stepToRewardMap[stepToClaim] || 0,
  //       source: 'onboarding',
  //     });
  //   } catch (_e) {
  //     // this means the reward has already been claimed
  //   }
  // }

  let nextCompletedSteps = Array.from(
    new Set(
      nextStep
        ? [...currentOnboardingSteps, stepToClaim]
        : currentOnboardingSteps,
    ),
  ).filter((step) => !!step);

  if (nextStep === 'restarted') {
    nextCompletedSteps = [];
  }

  await db
    .update(userProductOnboarding)
    .set({
      currentStep: nextStep,
      completedSteps: nextCompletedSteps,
    })
    .where(eq(userProductOnboarding.userId, userId));
}
