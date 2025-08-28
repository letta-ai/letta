import type { NextRequest } from 'next/server';
import { getUserActiveOrganizationIdOrThrow } from '$web/server/auth';
import * as process from 'node:process';
import { db, projects, inferenceModelsMetadata, organizationCredits } from '@letta-cloud/service-database';
import { eq, and } from 'drizzle-orm';
import { router } from '$web/web-api/router';
import {
  addCreditsToOrganization,
  removeCreditsFromOrganization,
  getOrganizationCredits,
} from '@letta-cloud/utils-server';

export async function POST(req: NextRequest) {
  const organizationId = await getUserActiveOrganizationIdOrThrow();

  if (
    !(
      process.env.IS_CYPRESS_RUN === 'yes' ||
      process.env.NODE_ENV !== 'production'
    )
  ) {
    return new Response(
      JSON.stringify({
        message: 'Unauthorized',
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }

  if (!organizationId) {
    return new Response(
      JSON.stringify({
        message: 'Unauthorized',
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }

  try {
    const { projects: projectsToSeed, models, credits } = await req.json();

    const seededData: any = {
      projects: [],
      models: [],
      credits: null,
    };

    // Seed projects if requested
    if (projectsToSeed && Array.isArray(projectsToSeed)) {
      for (const projectName of projectsToSeed) {
        // Check if project already exists
        const existingProject = await db.query.projects.findFirst({
          where: and(
            eq(projects.name, projectName),
            eq(projects.organizationId, organizationId),
          ),
        });

        if (!existingProject) {
          // Create project via API to ensure proper setup
          try {
            const projectResponse = await router.projects.createProject({
              body: {
                name: projectName,
              },
            });
            seededData.projects.push(projectResponse);
          } catch (error) {
            console.warn(`Failed to create project ${projectName}:`, error);
          }
        } else {
          seededData.projects.push(existingProject);
        }
      }
    }

    // Seed models if requested
    if (models) {
      async function addModel(modelName: string, modelEndpoint: string) {
        const existingModel = await db.query.inferenceModelsMetadata.findFirst({
          where: eq(inferenceModelsMetadata.modelName, modelName),
        });

        if (!existingModel) {
          try {
            const modelResponse = await router.admin.models.createAdminInferenceModel({
              body: {
                modelName,
                modelEndpoint,
              },
            });

            await router.admin.models.updateAdminInferenceModel({
              params: {
                // @ts-expect-error - this is valid
                id: modelResponse.body.id,

              },
              body: {
                disabled: false
              }
            })


            seededData.models.push(modelResponse);
          } catch (error) {
            console.warn('Failed to create gpt-4o-mini model:', error);
          }
        } else {
          if (existingModel.disabledAt) {
            await router.admin.models.updateAdminInferenceModel({
              params: {
                id: existingModel.id,
              },
              body: {
                disabled: false
              }
            })
          }

          seededData.models.push(existingModel);
        }
      }
      await Promise.all([
        addModel('gpt-4o-mini', 'https://api.openai.com/v1'),
        addModel('gpt-4.1-nano', 'https://api.openai.com/v1'),
        addModel('gpt-4o', 'https://api.openai.com/v1')

      ])
    }

    // Set credits if requested
    if (credits !== undefined) {
      try {
        const currentOrganizationCredits = await db.query.organizationCredits.findFirst({
          where: eq(organizationCredits.organizationId, organizationId),
          with: {
            organization: true,
          },
        });

        if (currentOrganizationCredits) {
          const orgCredits = parseInt(currentOrganizationCredits.credits, 10);

          // Reset to zero first
          if (orgCredits > 0) {
            await removeCreditsFromOrganization({
              note: 'E2E test seed data reset credits',
              amount: orgCredits,
              source: 'e2e-seed',
              coreOrganizationId: currentOrganizationCredits.organization.lettaAgentsId,
            });
          } else if (orgCredits < 0) {
            await addCreditsToOrganization({
              note: 'E2E test seed data reset credits',
              amount: Math.abs(orgCredits),
              source: 'e2e-seed',
              organizationId: currentOrganizationCredits.organizationId,
            });
          }

          // Set new credits
          if (credits > 0) {
            await addCreditsToOrganization({
              note: 'E2E test seed data set credits',
              amount: credits,
              source: 'e2e-seed',
              organizationId: currentOrganizationCredits.organizationId,
            });
          } else if (credits < 0) {
            await removeCreditsFromOrganization({
              note: 'E2E test seed data set credits',
              amount: Math.abs(credits),
              source: 'e2e-seed',
              coreOrganizationId: currentOrganizationCredits.organization.lettaAgentsId,
            });
          }

          seededData.credits = await getOrganizationCredits(organizationId);
        }
      } catch (error) {
        console.warn('Failed to set credits:', error);
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Test data seeded successfully',
        data: seededData,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('Error seeding test data:', error);
    return new Response(
      JSON.stringify({
        message: 'Failed to seed test data',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }
}
