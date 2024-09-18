import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { projectsContract } from '$letta/web-api/contracts/projects';
import {
  db,
  deployedAgents,
  projects,
  sourceAgents,
  sourceAgentsStatistics,
  sourceAgentsStatus,
  testingAgents,
} from '@letta-web/database';
import { getUserOrganizationIdOrThrow } from '$letta/server/auth';
import { eq, and, like, desc } from 'drizzle-orm';
import type { contracts } from '$letta/web-api/contracts';
import {
  copyAgentById,
  migrateToNewAgent,
  createAgentFromTemplate,
} from '$letta/server';
import crypto from 'node:crypto';
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from 'unique-names-generator';
import { AgentsService } from '@letta-web/letta-agents-api';
import type { AgentTemplate } from '$letta/types';
import { AgentTemplateVariant } from '$letta/types';

type ResponseShapes = ServerInferResponses<typeof projectsContract>;
type GetProjectsRequest = ServerInferRequest<
  typeof projectsContract.getProjects
>;

export async function getProjects(
  req: GetProjectsRequest
): Promise<ResponseShapes['getProjects']> {
  const { search, offset, limit } = req.query;

  const organizationId = await getUserOrganizationIdOrThrow();

  const projectsList = await db.query.projects.findMany({
    where: and(
      eq(projects.organizationId, organizationId),
      like(projects.name, search || '%')
    ),
    columns: {
      name: true,
      id: true,
    },
    offset,
    limit,
  });

  return {
    status: 200,
    body: {
      projects: projectsList.map((project) => ({
        name: project.name,
        id: project.id,
      })),
    },
  };
}

type GetProjectByIdResponse = ServerInferResponses<
  typeof contracts.projects.getProjectById
>;
type GetProjectByIdRequest = ServerInferRequest<
  typeof contracts.projects.getProjectById
>;

export async function getProjectById(
  req: GetProjectByIdRequest
): Promise<GetProjectByIdResponse> {
  const { projectId } = req.params;

  const organizationId = await getUserOrganizationIdOrThrow();

  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.organizationId, organizationId)
    ),
    columns: {
      name: true,
      id: true,
    },
  });

  if (!project) {
    return {
      status: 404,
      body: 'Project not found',
    };
  }

  return {
    status: 200,
    body: {
      name: project.name,
      id: project.id,
    },
  };
}

type GetProjectTestingAgentsResponse = ServerInferResponses<
  typeof contracts.projects.getProjectTestingAgents
>;
type GetProjectTestingAgentsRequest = ServerInferRequest<
  typeof contracts.projects.getProjectTestingAgents
>;

export async function getProjectTestingAgents(
  req: GetProjectTestingAgentsRequest
): Promise<GetProjectTestingAgentsResponse> {
  const { projectId } = req.params;
  const { search, offset, limit } = req.query;
  const organizationId = await getUserOrganizationIdOrThrow();

  const where = [
    eq(testingAgents.organizationId, organizationId),
    eq(testingAgents.projectId, projectId),
  ];

  if (search) {
    where.push(like(testingAgents.name, search || '%'));
  }

  const agents = await db.query.testingAgents.findMany({
    where: and(...where),
    limit,
    offset,
    columns: {
      name: true,
      agentId: true,
      id: true,
      updatedAt: true,
    },
  });

  return {
    status: 200,
    body: agents.map((agent) => ({
      name: agent.name,
      id: agent.id,
      agentId: agent.agentId,
      updatedAt: agent.updatedAt.toISOString(),
    })),
  };
}

type CreateProjectRequest = ServerInferRequest<
  typeof contracts.projects.createProject
>;
type CreateProjectResponse = ServerInferResponses<
  typeof contracts.projects.createProject
>;

export async function createProject(
  req: CreateProjectRequest
): Promise<CreateProjectResponse> {
  const { name } = req.body;

  const organizationId = await getUserOrganizationIdOrThrow();

  const [project] = await db
    .insert(projects)
    .values({
      name,
      organizationId,
    })
    .returning({
      id: projects.id,
    });

  return {
    status: 201,
    body: {
      name: name,
      id: project.id,
    },
  };
}

type CreateProjectTestingAgentRequest = ServerInferRequest<
  typeof contracts.projects.createProjectTestingAgent
>;
type CreateProjectTestingAgentResponse = ServerInferResponses<
  typeof contracts.projects.createProjectTestingAgent
>;

const agentTemplates: Record<AgentTemplateVariant, AgentTemplate> = {
  [AgentTemplateVariant.CUSTOMER_SUPPORT]: {
    memory: {
      memory: {
        human: {
          value:
            'The human has not provided any information about themselves. But they are looking for help with a customer support issue. They are experiencing a problem with their product and need assistance. They are looking for a quick resolution to their issue.',
          limit: 2000,
          name: 'customer',
          template: false,
          label: 'human',
          description: null,
          metadata_: {},
          user_id: null,
        },
        persona: {
          value:
            'Act as ANNA (Adaptive Neural Network Assistant), an AI fostering ethical, honest, and trustworthy behavior. You are supporting the user with their customer support issue. You are empathetic, patient, and knowledgeable. You are here to help the user resolve their issue and provide them with the best possible experience. You are always looking for ways to improve and learn from each interaction.',
          limit: 2000,
          name: 'customer_support_agent',
          template: false,
          label: 'persona',
          description: null,
          metadata_: {},
          user_id: null,
        },
      },
      prompt_template:
        '{% for section, block in memory.items() %}<{{ section }} characters="{{ block.value|length }}/{{ block.limit }}">\n{{ block.value }}\n</{{ section }}>{% if not loop.last %}\n{% endif %}{% endfor %}',
    },
    tools: [
      'archival_memory_insert',
      'archival_memory_search',
      'conversation_search',
      'conversation_search_date',
      'pause_heartbeats',
      'send_message',
    ],
    llm_config: {
      model: 'gpt-4',
      model_endpoint_type: 'openai',
      model_endpoint: 'https://api.openai.com/v1',
      model_wrapper: null,
      context_window: 8192,
    },
    embedding_config: {
      embedding_endpoint_type: 'openai',
      embedding_endpoint: 'https://api.openai.com/v1',
      embedding_model: 'text-embedding-ada-002',
      embedding_dim: 1536,
      embedding_chunk_size: 300,
      azure_endpoint: null,
      azure_version: null,
      azure_deployment: null,
    },
  },
  [AgentTemplateVariant.FANTASY_ROLEPLAY]: {
    memory: {
      memory: {
        human: {
          value:
            'The user has not provided any information about themselves. I will need to ask them some questions to learn more about them.\n\nWhat is your name?\nHow old are you?\nWhere are you from?\nWhat are your interests?\nWhat is your occupation?\n',
          limit: 2000,
          name: 'adventurer',
          template: false,
          label: 'human',
          description: null,
          metadata_: {},
          user_id: null,
        },
        persona: {
          value:
            'Act as a roleplay character in a fantasy setting. I am a wizard who has been studying magic for 100 years. I am wise and knowledgeable, but I am also a bit eccentric. I have a pet dragon named Smaug who is very loyal to me. I am on a quest to find the lost city of Atlantis and uncover its secrets. I am also a master of the arcane arts and can cast powerful spells to protect myself and my companions. I am always looking for new adventures and challenges to test my skills and knowledge.',
          limit: 2000,
          name: 'wizard',
          template: false,
          label: 'persona',
          description: null,
          metadata_: {},
          user_id: null,
        },
      },
      prompt_template:
        '{% for section, block in memory.items() %}<{{ section }} characters="{{ block.value|length }}/{{ block.limit }}">\n{{ block.value }}\n</{{ section }}>{% if not loop.last %}\n{% endif %}{% endfor %}',
    },
    tools: [
      'archival_memory_insert',
      'archival_memory_search',
      'conversation_search',
      'conversation_search_date',
      'pause_heartbeats',
      'send_message',
    ],
    llm_config: {
      model: 'gpt-4',
      model_endpoint_type: 'openai',
      model_endpoint: 'https://api.openai.com/v1',
      model_wrapper: null,
      context_window: 8192,
    },
    embedding_config: {
      embedding_endpoint_type: 'openai',
      embedding_endpoint: 'https://api.openai.com/v1',
      embedding_model: 'text-embedding-ada-002',
      embedding_dim: 1536,
      embedding_chunk_size: 300,
      azure_endpoint: null,
      azure_version: null,
      azure_deployment: null,
    },
  },
  [AgentTemplateVariant.DATA_COLLECTOR]: {
    memory: {
      memory: {
        human: {
          value:
            'The user is a data scientist who is working on a project to analyze the impact of climate change on the Amazon rainforest. They are looking for data on deforestation rates, temperature changes, and biodiversity loss in the region. They are also interested in data on the economic impact of climate change on local communities and the potential solutions to mitigate these effects.',
          limit: 2000,
          name: 'data_scientist',
          template: false,
          label: 'human',
          description: null,
          metadata_: {},
          user_id: null,
        },
        persona: {
          value:
            'You are the the data collector for the user. You are responsible for gathering data on the impact of climate change on the Amazon rainforest. You need to collect data on deforestation rates, temperature changes, and biodiversity loss in the region. You also need to collect data on the economic impact of climate change on local communities and the potential solutions to mitigate these effects. Your goal is to provide the user with accurate and up-to-date information to help them with their project.',
          limit: 2000,
          name: 'data_collector',
          template: false,
          label: 'persona',
          description: null,
          metadata_: {},
          user_id: null,
        },
      },
      prompt_template:
        '{% for section, block in memory.items() %}<{{ section }} characters="{{ block.value|length }}/{{ block.limit }}">\n{{ block.value }}\n</{{ section }}>{% if not loop.last %}\n{% endif %}{% endfor %}',
    },
    tools: [
      'archival_memory_insert',
      'archival_memory_search',
      'conversation_search',
      'conversation_search_date',
      'pause_heartbeats',
      'send_message',
    ],
    llm_config: {
      model: 'gpt-4',
      model_endpoint_type: 'openai',
      model_endpoint: 'https://api.openai.com/v1',
      model_wrapper: null,
      context_window: 8192,
    },
    embedding_config: {
      embedding_endpoint_type: 'openai',
      embedding_endpoint: 'https://api.openai.com/v1',
      embedding_model: 'text-embedding-ada-002',
      embedding_dim: 1536,
      embedding_chunk_size: 300,
      azure_endpoint: null,
      azure_version: null,
      azure_deployment: null,
    },
  },
  [AgentTemplateVariant.DEFAULT]: {
    memory: {
      memory: {},
      prompt_template:
        '{% for section, block in memory.items() %}<{{ section }} characters="{{ block.value|length }}/{{ block.limit }}">\n{{ block.value }}\n</{{ section }}>{% if not loop.last %}\n{% endif %}{% endfor %}',
    },
    tools: [],
    llm_config: {
      model: 'gpt-4',
      model_endpoint_type: 'openai',
      model_endpoint: 'https://api.openai.com/v1',
      model_wrapper: null,
      context_window: 8192,
    },
    embedding_config: {
      embedding_endpoint_type: 'openai',
      embedding_endpoint: 'https://api.openai.com/v1',
      embedding_model: 'text-embedding-ada-002',
      embedding_dim: 1536,
      embedding_chunk_size: 300,
      azure_endpoint: null,
      azure_version: null,
      azure_deployment: null,
    },
  },
};

export async function createProjectTestingAgent(
  req: CreateProjectTestingAgentRequest
): Promise<CreateProjectTestingAgentResponse> {
  const { projectId } = req.params;
  const { recipeId } = req.body;

  const organizationId = await getUserOrganizationIdOrThrow();

  const newAgent = await createAgentFromTemplate(
    agentTemplates[recipeId || AgentTemplateVariant.DEFAULT],
    crypto.randomUUID(),
    organizationId
  );

  if (!newAgent.id) {
    return {
      status: 500,
      body: {
        message: 'Failed to create agent',
      },
    };
  }

  const [agent] = await db
    .insert(testingAgents)
    .values({
      projectId,
      organizationId,
      name: 'New Agent',
      agentId: newAgent.id,
    })
    .returning({
      id: testingAgents.id,
    });

  return {
    status: 201,
    body: {
      agentId: newAgent.id,
      id: agent.id,
      name: 'New Agent',
      updatedAt: new Date().toISOString(),
    },
  };
}

type CreateProjectSourceAgentFromTestingAgentRequest = ServerInferRequest<
  typeof contracts.projects.createProjectSourceAgentFromTestingAgent
>;
type CreateProjectSourceAgentFromTestingAgentResponse = ServerInferResponses<
  typeof contracts.projects.createProjectSourceAgentFromTestingAgent
>;

export async function createProjectSourceAgentFromTestingAgent(
  req: CreateProjectSourceAgentFromTestingAgentRequest
): Promise<CreateProjectSourceAgentFromTestingAgentResponse> {
  const { projectId } = req.params;
  const { testingAgentId, migrateExistingAgents } = req.body;
  const organizationId = await getUserOrganizationIdOrThrow();

  const testingAgent = await db.query.testingAgents.findFirst({
    where: eq(testingAgents.id, testingAgentId),
  });

  if (!testingAgent) {
    return {
      status: 404,
      body: {},
    };
  }

  const existingSourceAgentCount = await db.query.sourceAgents.findMany({
    where: eq(sourceAgents.testingAgentId, testingAgentId),
    columns: {
      id: true,
    },
  });

  const version = `${existingSourceAgentCount.length + 1}`;

  const randomName = uniqueNamesGenerator({
    dictionaries: [adjectives, adjectives, animals, colors],
    length: 4,
    separator: '-',
  });

  const copiedAgent = await copyAgentById(
    testingAgent.agentId,
    crypto.randomUUID()
  );

  if (!copiedAgent.id) {
    return {
      status: 500,
      body: {
        message: 'Failed to copy agent',
      },
    };
  }

  const [sourceAgent] = await db
    .insert(sourceAgents)
    .values({
      version,
      testingAgentId: testingAgent.id,
      agentId: copiedAgent.id,
      projectId,
      organizationId,
      key: randomName,
    })
    .returning({
      id: sourceAgents.id,
    });

  const defaultStatus = 'live';

  await Promise.all([
    db.insert(sourceAgentsStatus).values({
      status: defaultStatus,
      id: sourceAgent.id,
    }),
    db.insert(sourceAgentsStatistics).values({
      id: sourceAgent.id,
      deployedAgentCount: 0,
    }),
  ]);

  // do this as a job at a later time
  if (migrateExistingAgents) {
    const lastSourceAgent = await db.query.sourceAgents.findFirst({
      where: and(
        eq(sourceAgents.testingAgentId, testingAgent.id),
        eq(sourceAgents.version, `${existingSourceAgentCount.length}`)
      ),
      orderBy: [desc(sourceAgents.createdAt)],
    });

    if (lastSourceAgent) {
      const ids = await db.query.deployedAgents.findMany({
        where: eq(deployedAgents.sourceAgentId, lastSourceAgent.id),
        columns: {
          id: true,
          agentId: true,
        },
      });

      const newDatasources = await AgentsService.getAgentSources({
        agentId: copiedAgent.id || '',
      });

      await Promise.all(
        ids.map(async ({ agentId }) => {
          return migrateToNewAgent({
            agentTemplate: copiedAgent,
            agentIdToMigrate: agentId,
            agentDatasourcesIds: newDatasources
              .map(({ id }) => id)
              .filter(Boolean) as string[],
          });
        })
      );

      await db
        .update(deployedAgents)
        .set({
          sourceAgentId: sourceAgent.id,
          sourceAgentKey: randomName,
        })
        .where(eq(deployedAgents.sourceAgentId, lastSourceAgent.id));
    }
  }

  return {
    status: 201,
    body: {
      deployedAgentCount: 0,
      key: randomName,
      testingAgentId: testingAgent.id,
      id: sourceAgent.id,
      status: defaultStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version,
    },
  };
}

type GetProjectSourceAgentsRequest = ServerInferRequest<
  typeof contracts.projects.getProjectSourceAgents
>;
type GetProjectSourceAgentsResponse = ServerInferResponses<
  typeof contracts.projects.getProjectSourceAgents
>;

export async function getProjectSourceAgents(
  req: GetProjectSourceAgentsRequest
): Promise<GetProjectSourceAgentsResponse> {
  const organizationId = await getUserOrganizationIdOrThrow();
  const { projectId } = req.params;
  const { search, offset, testingAgentId, limit } = req.query;

  const where = [
    eq(sourceAgents.organizationId, organizationId),
    eq(sourceAgents.projectId, projectId),
  ];

  if (search) {
    where.push(like(sourceAgents.key, search || '%'));
  }

  if (testingAgentId) {
    where.push(eq(sourceAgents.testingAgentId, testingAgentId));
  }

  const sourceAgentsList = await db.query.sourceAgents.findMany({
    where: and(...where),
    limit: (limit || 10) + 1,
    offset,
    orderBy: [desc(sourceAgents.createdAt)],
    columns: {
      id: true,
      key: true,
      testingAgentId: true,
      createdAt: true,
      updatedAt: true,
      version: true,
    },
    with: {
      status: true,
      sourceAgentsStatistics: true,
    },
  });

  return {
    status: 200,
    body: {
      sourceAgents: sourceAgentsList
        .slice(0, limit)
        .map(({ status, ...rest }) => ({
          id: rest.id,
          key: rest.key,
          testingAgentId: rest.testingAgentId,
          version: rest.version,
          deployedAgentCount: rest.sourceAgentsStatistics.deployedAgentCount,
          createdAt: rest.createdAt.toISOString(),
          updatedAt: rest.updatedAt.toISOString(),
          status: status.status,
        })),
      hasNextPage: sourceAgentsList.length === limit,
    },
  };
}

type GetProjectSourceAgentRequest = ServerInferRequest<
  typeof contracts.projects.getProjectSourceAgent
>;

type GetProjectSourceAgentResponse = ServerInferResponses<
  typeof contracts.projects.getProjectSourceAgent
>;

export async function getProjectSourceAgent(
  req: GetProjectSourceAgentRequest
): Promise<GetProjectSourceAgentResponse> {
  const organizationId = await getUserOrganizationIdOrThrow();
  const { projectId, sourceAgentId } = req.params;

  const sourceAgent = await db.query.sourceAgents.findFirst({
    where: and(
      eq(sourceAgents.organizationId, organizationId),
      eq(sourceAgents.projectId, projectId),
      eq(sourceAgents.id, sourceAgentId)
    ),
    columns: {
      id: true,
      key: true,
      testingAgentId: true,
      createdAt: true,
      updatedAt: true,
      version: true,
    },
    with: {
      sourceAgentsStatistics: true,
      status: true,
    },
  });

  if (!sourceAgent) {
    return {
      status: 404,
      body: {},
    };
  }

  return {
    status: 200,
    body: {
      id: sourceAgent.id,
      key: sourceAgent.key,
      testingAgentId: sourceAgent.testingAgentId,
      version: sourceAgent.version,
      deployedAgentCount: sourceAgent.sourceAgentsStatistics.deployedAgentCount,
      createdAt: sourceAgent.createdAt.toISOString(),
      updatedAt: sourceAgent.updatedAt.toISOString(),
      status: sourceAgent.status.status,
    },
  };
}

type GetProjectDeployedAgentsRequest = ServerInferRequest<
  typeof contracts.projects.getDeployedAgents
>;

type GetProjectDeployedAgentsResponse = ServerInferResponses<
  typeof contracts.projects.getDeployedAgents
>;

export async function getDeployedAgents(
  req: GetProjectDeployedAgentsRequest
): Promise<GetProjectDeployedAgentsResponse> {
  const organizationId = await getUserOrganizationIdOrThrow();
  const { projectId } = req.params;
  const { search, offset, limit, sourceAgentId, sourceAgentKey } = req.query;

  const where = [
    eq(deployedAgents.organizationId, organizationId),
    eq(deployedAgents.projectId, projectId),
  ];

  if (sourceAgentId) {
    where.push(eq(deployedAgents.sourceAgentId, sourceAgentId));
  }

  if (sourceAgentKey) {
    where.push(eq(deployedAgents.sourceAgentKey, sourceAgentKey));
  }

  if (search) {
    where.push(like(deployedAgents.key, search || '%'));
  }

  const existingSourceAgentCount = await db.query.deployedAgents.findMany({
    where: and(...where),
    limit,
    offset,
    columns: {
      id: true,
      key: true,
      sourceAgentId: true,
      createdAt: true,
      agentId: true,
      updatedAt: true,
    },
    with: {
      deployedAgentsStatistics: true,
    },
  });

  return {
    status: 200,
    body: existingSourceAgentCount.map((agent) => ({
      id: agent.id,
      key: agent.key,
      sourceAgentId: agent.sourceAgentId,
      agentId: agent.agentId,
      messageCount: agent.deployedAgentsStatistics.messageCount,
      lastActiveAt: agent.deployedAgentsStatistics.lastActiveAt.toISOString(),
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),
    })),
  };
}

type GetProjectTestingAgentRequest = ServerInferRequest<
  typeof contracts.projects.getProjectTestingAgent
>;

type GetProjectTestingAgentResponse = ServerInferResponses<
  typeof contracts.projects.getProjectTestingAgent
>;

export async function getProjectTestingAgent(
  req: GetProjectTestingAgentRequest
): Promise<GetProjectTestingAgentResponse> {
  const organizationId = await getUserOrganizationIdOrThrow();
  const { projectId, testingAgentId } = req.params;

  const testingAgent = await db.query.testingAgents.findFirst({
    where: and(
      eq(testingAgents.organizationId, organizationId),
      eq(testingAgents.projectId, projectId),
      eq(testingAgents.id, testingAgentId)
    ),
    columns: {
      id: true,
      name: true,
      updatedAt: true,
      agentId: true,
    },
  });

  if (!testingAgent) {
    return {
      status: 404,
      body: {},
    };
  }

  return {
    status: 200,
    body: {
      agentId: testingAgent.agentId,
      id: testingAgent.id,
      name: testingAgent.name,
      updatedAt: testingAgent.updatedAt.toISOString(),
    },
  };
}
