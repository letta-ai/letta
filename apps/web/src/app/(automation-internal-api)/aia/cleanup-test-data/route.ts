import { getUser, getUserActiveOrganizationIdOrThrow } from '$web/server/auth';
import * as process from 'node:process';
import {
  db,
  projects,
  lettaAPIKeys,
  clientSideAccessTokens,
  organizationCredits,
} from '@letta-cloud/service-database';
import { eq, and } from 'drizzle-orm';
import {
  addCreditsToOrganization,
  removeCreditsFromOrganization,
} from '@letta-cloud/utils-server';
import { FoldersService, ToolsService } from '@letta-cloud/sdk-core';

interface CleanupTestDataRequest {
  dataSources?: string[];
  tools?: string[];
  pattern?: string;
}

async function deleteDataSource(name: string) {
  const user = await getUser();
  if (!user) {
    throw new Error('User not found');
  }
  const { lettaAgentsId } = user;

  const folderId = await FoldersService.getFolderIdByName({
    folderName: name,
  }, {
    user_id: lettaAgentsId,
  }).catch((_) => {
    return null;
  });



  if (folderId) {
    await FoldersService.deleteFolder({
      folderId,
    }, {
      user_id: lettaAgentsId,
    }).catch((error) => {
      console.warn(`Failed to delete folder ${name}:`, error);
      return;
    });
    console.log(`Deleted data source: ${name}`);
  } else {
    console.warn(`Data source not found: ${name}`);
  }
}

async function deleteTool(name: string) {
  const user = await getUser();
  if (!user) {
    throw new Error('User not found');
  }
  const { lettaAgentsId } = user;


  const tools = await ToolsService.listTools({
    limit: 250,
  }, {
    user_id: lettaAgentsId
  })

  const tool = tools.find((tool) => tool.name === name);

  if (tool) {
    await ToolsService.deleteTool({
      toolId: tool.id!,
    }, {
      user_id: lettaAgentsId,
    });
    console.log(`Deleted tool: ${name}`);
  } else {
    console.warn(`Tool not found: ${name}`);
  }
}

export async function POST(request: Request) {
  const organizationId = await getUserActiveOrganizationIdOrThrow();

  // Parse request body
  let body: CleanupTestDataRequest = {};
  try {
    const requestBody = await request.text();
    if (requestBody.trim()) {
      body = JSON.parse(requestBody);
    }
  } catch (error) {
    console.warn(
      'Failed to parse cleanup request body, using defaults:',
      error,
    );
  }

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
    const cleanupResults: any = {
      projects: 0,
      apiKeys: 0,
      clientSideTokens: 0,
      creditsReset: false,
      dataSourcesCleanedUp: [],
      toolsCleanedUp: [],
    };

    // Clean up test projects (those with test-related names)
    const testProjectNames = [
      'CYDOGGTestProject',
      'DEPLOYMENTEST',
      'CYDOGGCREDITS',
      'CYDOGGRATELIMIT',
      'ExampleProject',
    ];

    // Handle data sources and tools cleanup
    if (body.dataSources && body.dataSources.length > 0) {
      cleanupResults.dataSourcesCleanedUp = body.dataSources;
      await Promise.all(
        body.dataSources.map((dsName) => deleteDataSource(dsName)),
      );
    }

    if (body.tools && body.tools.length > 0) {
      cleanupResults.toolsCleanedUp = body.tools;
      await Promise.all(body.tools.map((toolName) => deleteTool(toolName)));
    }

    for (const projectName of testProjectNames) {
      const deletedProjects = await db
        .delete(projects)
        .where(
          and(
            eq(projects.name, projectName),
            eq(projects.organizationId, organizationId),
          ),
        )
        .execute();

      const result = deletedProjects as any;
      if (result.rowCount) {
        cleanupResults.projects += result.rowCount;
      }
    }

    // Clean up test API keys
    const testApiKeyNames = ['APIKEYTEST', 'CypressAPIKey', 'SECONDAPIKEY'];

    // Additional API keys are handled above in the entitiesToDelete section

    for (const keyName of testApiKeyNames) {
      const deletedKeys = await db
        .delete(lettaAPIKeys)
        .where(
          and(
            eq(lettaAPIKeys.name, keyName),
            eq(lettaAPIKeys.organizationId, organizationId),
          ),
        )
        .execute();

      const keyResult = deletedKeys as any;
      if (keyResult.rowCount) {
        cleanupResults.apiKeys += keyResult.rowCount;
      }
    }

    // Clean up client-side access tokens
    const deletedTokens = await db
      .delete(clientSideAccessTokens)
      .where(eq(clientSideAccessTokens.organizationId, organizationId))
      .execute();

    const tokenResult = deletedTokens as any;
    if (tokenResult.rowCount) {
      cleanupResults.clientSideTokens = tokenResult.rowCount;
    }

    // Reset organization credits to a reasonable default
    try {
      const currentOrganizationCredits =
        await db.query.organizationCredits.findFirst({
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
            note: 'E2E test cleanup reset credits',
            amount: orgCredits,
            source: 'e2e-cleanup',
            coreOrganizationId:
              currentOrganizationCredits.organization.lettaAgentsId,
          });
        } else if (orgCredits < 0) {
          await addCreditsToOrganization({
            note: 'E2E test cleanup reset credits',
            amount: Math.abs(orgCredits),
            source: 'e2e-cleanup',
            organizationId: currentOrganizationCredits.organizationId,
          });
        }

        // Set to reasonable default (100 credits)
        await addCreditsToOrganization({
          note: 'E2E test cleanup default credits',
          amount: 100,
          source: 'e2e-cleanup',
          organizationId: currentOrganizationCredits.organizationId,
        });

        cleanupResults.creditsReset = true;
      }
    } catch (error) {
      console.warn('Failed to reset credits during cleanup:', error);
    }

    return new Response(
      JSON.stringify({
        message: 'Test data cleanup completed',
        results: cleanupResults,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('Error during test data cleanup:', error);
    return new Response(
      JSON.stringify({
        message: 'Failed to cleanup test data',
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
