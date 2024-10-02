import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import { UpdateProjectAgentTemplateErrors } from '$letta/web-api/contracts';
import {
  db,
  deployedAgents,
  projects,
  deployedAgentTemplates,
  agentTemplates,
} from '@letta-web/database';
import type { GetUserDataResponse } from '$letta/server/auth';
import {
  getUserOrganizationIdOrThrow,
  getUserOrThrow,
} from '$letta/server/auth';
import { eq, and, like, desc, count } from 'drizzle-orm';
import type { contracts, projectsContract } from '$letta/web-api/contracts';
import { findUniqueAgentTemplateName, generateSlug } from '$letta/server';
import { AgentsService } from '@letta-web/letta-agents-api';
import type { AgentTemplate } from '$letta/types';
import { AgentRecipieVariant } from '$letta/types';
import { capitalize } from 'lodash-es';
import { copyAgentById, createAgent } from '$letta/sdk';

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
      slug: true,
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
        slug: project.slug,
      })),
    },
  };
}

type GetProjectByIdResponse = ServerInferResponses<
  typeof contracts.projects.getProjectByIdOrSlug
>;
type GetProjectByIdRequest = ServerInferRequest<
  typeof contracts.projects.getProjectByIdOrSlug
>;

export async function getProjectByIdOrSlug(
  req: GetProjectByIdRequest
): Promise<GetProjectByIdResponse> {
  const { projectId } = req.params;
  const { lookupBy } = req.query;

  const organizationId = await getUserOrganizationIdOrThrow();

  const query = [eq(projects.organizationId, organizationId)];

  if (lookupBy === 'slug') {
    query.push(eq(projects.slug, projectId));
  } else {
    query.push(eq(projects.id, projectId));
  }

  const project = await db.query.projects.findFirst({
    where: and(...query),
    columns: {
      name: true,
      id: true,
      slug: true,
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
      slug: project.slug,
    },
  };
}

type GetProjectAgentTemplatesResponse = ServerInferResponses<
  typeof contracts.projects.getProjectAgentTemplates
>;
type GetProjectAgentTemplatesRequest = ServerInferRequest<
  typeof contracts.projects.getProjectAgentTemplates
>;

export async function getProjectAgentTemplates(
  req: GetProjectAgentTemplatesRequest
): Promise<GetProjectAgentTemplatesResponse> {
  const { projectId } = req.params;
  const { search, offset, limit } = req.query;
  const organizationId = await getUserOrganizationIdOrThrow();

  const where = [
    eq(agentTemplates.organizationId, organizationId),
    eq(agentTemplates.projectId, projectId),
  ];

  if (search) {
    where.push(like(agentTemplates.name, search || '%'));
  }

  const agents = await db.query.agentTemplates.findMany({
    where: and(...where),
    limit,
    offset,
    columns: {
      name: true,
      id: true,
      updatedAt: true,
    },
    orderBy: [desc(agentTemplates.createdAt)],
  });

  return {
    status: 200,
    body: agents.map((agent) => ({
      name: agent.name,
      id: agent.id,
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

  let projectSlug = generateSlug(name);

  const existingProject = await db.query.projects.findFirst({
    where: and(
      eq(projects.organizationId, organizationId),
      eq(projects.slug, projectSlug)
    ),
  });

  if (existingProject) {
    // get total project count
    const projectCount = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.organizationId, organizationId));

    projectSlug = `${projectSlug}-${projectCount}`;
  }

  const [project] = await db
    .insert(projects)
    .values({
      slug: projectSlug,
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
      slug: projectSlug,
    },
  };
}

type CreateProjectAgentTemplateRequest = ServerInferRequest<
  typeof contracts.projects.createProjectAgentTemplate
>;
type CreateProjectAgentTemplateResponse = ServerInferResponses<
  typeof contracts.projects.createProjectAgentTemplate
>;

const agentRecipies: Record<AgentRecipieVariant, AgentTemplate> = {
  [AgentRecipieVariant.CUSTOMER_SUPPORT]: {
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
  [AgentRecipieVariant.FANTASY_ROLEPLAY]: {
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
  [AgentRecipieVariant.DATA_COLLECTOR]: {
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
  [AgentRecipieVariant.DEFAULT]: {
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

interface Context {
  request: {
    $userOverride?: GetUserDataResponse;
  };
}

export async function createProjectAgentTemplate(
  req: CreateProjectAgentTemplateRequest,
  context: Context
): Promise<CreateProjectAgentTemplateResponse> {
  const { projectId } = req.params;
  const { recipeId } = req.body;

  const {
    lettaAgentsId,
    id: userId,
    organizationId,
  } = context.request?.$userOverride || (await getUserOrThrow());

  const name = await findUniqueAgentTemplateName();

  const recipe = agentRecipies[recipeId || 'customer_support'];

  const agent = await createAgent(
    {
      body: {
        name,
        template: true,
        project_id: projectId,
        memory: recipe.memory,
        tools: recipe.tools,
        llm_config: recipe.llm_config,
        embedding_config: recipe.embedding_config,
      },
    },
    {
      request: {
        organizationId,
        lettaAgentsUserId: lettaAgentsId,
        userId,
      },
    }
  );

  if (agent.status !== 201 || !agent.body.id) {
    return {
      status: 500,
      body: {
        message: 'Failed to create agent',
      },
    };
  }

  return {
    status: 201,
    body: {
      id: agent.body.id,
      name,
      updatedAt: new Date().toISOString(),
    },
  };
}

type UpdateProjectAgentTemplateRequest = ServerInferRequest<
  typeof contracts.projects.updateProjectAgentTemplate
>;

type UpdateProjectAgentTemplateResponse = ServerInferResponses<
  typeof contracts.projects.updateProjectAgentTemplate
>;

export async function updateProjectAgentTemplate(
  req: UpdateProjectAgentTemplateRequest
): Promise<UpdateProjectAgentTemplateResponse> {
  const { projectId, agentTemplateId } = req.params;

  const organizationId = await getUserOrganizationIdOrThrow();

  const testingAgent = await db.query.agentTemplates.findFirst({
    where: and(
      eq(agentTemplates.organizationId, organizationId),
      eq(agentTemplates.projectId, projectId),
      eq(agentTemplates.id, agentTemplateId)
    ),
  });

  if (!testingAgent) {
    return {
      status: 404,
      body: {},
    };
  }

  const { name } = req.body;

  if (!name) {
    return {
      status: 400,
      body: {
        message: UpdateProjectAgentTemplateErrors.NAME_REQUIRED,
      },
    };
  }

  // name must be alphanumeric-with-dashes-or-underscores
  if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
    return {
      status: 400,
      body: {
        message: UpdateProjectAgentTemplateErrors.ALPHANUMERIC_NAME_ONLY,
      },
    };
  }

  // check if agent with the same name exists
  const existingAgent = await db.query.agentTemplates.findFirst({
    where: and(
      eq(agentTemplates.organizationId, organizationId),
      eq(agentTemplates.projectId, projectId),
      eq(agentTemplates.name, name)
    ),
  });

  if (existingAgent && existingAgent.id !== testingAgent.id) {
    return {
      status: 409,
      body: {
        message: UpdateProjectAgentTemplateErrors.CONFLICTING_NAME,
      },
    };
  }

  await db
    .update(agentTemplates)
    .set({
      name,
    })
    .where(eq(agentTemplates.id, agentTemplateId));

  return {
    status: 200,
    body: {
      name: name || testingAgent.name,
      id: testingAgent.id,
      updatedAt: new Date().toISOString(),
    },
  };
}

type DeleteProjectAgentTemplateRequest = ServerInferRequest<
  typeof contracts.projects.deleteProjectAgentTemplate
>;

type DeleteProjectAgentTemplateResponse = ServerInferResponses<
  typeof contracts.projects.deleteProjectAgentTemplate
>;

export async function deleteProjectAgentTemplate(
  req: DeleteProjectAgentTemplateRequest
): Promise<DeleteProjectAgentTemplateResponse> {
  const { projectId, agentTemplateId } = req.params;
  const organizationId = await getUserOrganizationIdOrThrow();

  const testingAgent = await db.query.agentTemplates.findFirst({
    where: and(
      eq(agentTemplates.organizationId, organizationId),
      eq(agentTemplates.projectId, projectId),
      eq(agentTemplates.id, agentTemplateId)
    ),
  });

  if (!testingAgent) {
    return {
      status: 404,
      body: {},
    };
  }

  await AgentsService.deleteAgent({
    agentId: testingAgent.id,
  });
  await db.delete(agentTemplates).where(eq(agentTemplates.id, agentTemplateId));

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type GetProjectDeployedAgentTemplatesRequest = ServerInferRequest<
  typeof contracts.projects.getProjectDeployedAgentTemplates
>;
type GetProjectDeployedAgentTemplatesResponse = ServerInferResponses<
  typeof contracts.projects.getProjectDeployedAgentTemplates
>;

export async function getProjectDeployedAgentTemplates(
  req: GetProjectDeployedAgentTemplatesRequest
): Promise<GetProjectDeployedAgentTemplatesResponse> {
  const organizationId = await getUserOrganizationIdOrThrow();
  const { projectId } = req.params;
  const { search, offset, agentTemplateId, limit, includeAgentTemplateInfo } =
    req.query;

  const where = [
    eq(deployedAgentTemplates.organizationId, organizationId),
    eq(deployedAgentTemplates.projectId, projectId),
  ];

  if (search) {
    where.push(like(deployedAgentTemplates.version, search || '%'));
  }

  if (agentTemplateId) {
    where.push(eq(deployedAgentTemplates.agentTemplateId, agentTemplateId));
  }

  const deployedAgentTemplatesList =
    await db.query.deployedAgentTemplates.findMany({
      where: and(...where),
      limit: (limit || 10) + 1,
      offset,
      orderBy: [desc(deployedAgentTemplates.createdAt)],
      columns: {
        id: true,
        agentTemplateId: true,
        createdAt: true,
        updatedAt: true,
        version: true,
      },
      with: {
        ...(includeAgentTemplateInfo
          ? { agentTemplate: { columns: { name: true } } }
          : {}),
      },
    });

  return {
    status: 200,
    body: {
      deployedAgentTemplates: deployedAgentTemplatesList
        .slice(0, limit)
        .map(({ agentTemplate, ...rest }) => ({
          id: rest.id,
          agentTemplateId: rest.agentTemplateId,
          testingAgentName: agentTemplate?.name,
          version: rest.version,
          createdAt: rest.createdAt.toISOString(),
          updatedAt: rest.updatedAt.toISOString(),
        })),
      hasNextPage: deployedAgentTemplatesList.length === limit,
    },
  };
}

type GetProjectDeployedAgentTemplateRequest = ServerInferRequest<
  typeof contracts.projects.getProjectDeployedAgentTemplate
>;

type GetProjectDeployedAgentTemplateResponse = ServerInferResponses<
  typeof contracts.projects.getProjectDeployedAgentTemplate
>;

export async function getProjectDeployedAgentTemplate(
  req: GetProjectDeployedAgentTemplateRequest
): Promise<GetProjectDeployedAgentTemplateResponse> {
  const organizationId = await getUserOrganizationIdOrThrow();
  const { projectId, deployedAgentTemplateId } = req.params;

  const deployedAgentTemplate = await db.query.deployedAgentTemplates.findFirst(
    {
      where: and(
        eq(deployedAgentTemplates.organizationId, organizationId),
        eq(deployedAgentTemplates.projectId, projectId),
        eq(deployedAgentTemplates.id, deployedAgentTemplateId)
      ),
      columns: {
        id: true,
        agentTemplateId: true,
        createdAt: true,
        updatedAt: true,
        version: true,
      },
    }
  );

  if (!deployedAgentTemplate) {
    return {
      status: 404,
      body: {},
    };
  }

  return {
    status: 200,
    body: {
      id: deployedAgentTemplate.id,
      agentTemplateId: deployedAgentTemplate.agentTemplateId,
      version: deployedAgentTemplate.version,
      createdAt: deployedAgentTemplate.createdAt.toISOString(),
      updatedAt: deployedAgentTemplate.updatedAt.toISOString(),
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
  const { search, offset, limit = 10, deployedAgentTemplateId } = req.query;

  const where = [
    eq(deployedAgents.organizationId, organizationId),
    eq(deployedAgents.projectId, projectId),
  ];

  if (deployedAgentTemplateId) {
    where.push(
      eq(deployedAgents.deployedAgentTemplateId, deployedAgentTemplateId)
    );
  }

  if (search) {
    where.push(like(deployedAgents.key, `%${search}%` || '%'));
  }

  const existingDeployedAgentTemplateCount =
    await db.query.deployedAgents.findMany({
      where: and(...where),
      limit: limit + 1,
      offset,
      columns: {
        id: true,
        key: true,
        deployedAgentTemplateId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [desc(deployedAgents.createdAt)],
    });

  return {
    status: 200,
    body: {
      agents: existingDeployedAgentTemplateCount
        .slice(0, limit)
        .map((agent) => ({
          id: agent.id,
          key: agent.key,
          deployedAgentTemplateId: agent.deployedAgentTemplateId,
          createdAt: agent.createdAt.toISOString(),
          updatedAt: agent.updatedAt.toISOString(),
        })),
      hasNextPage: existingDeployedAgentTemplateCount.length === limit + 1,
    },
  };
}

type GetProjectAgentTemplateRequest = ServerInferRequest<
  typeof contracts.projects.getTestingAgentByIdOrName
>;

type GetProjectAgentTemplateResponse = ServerInferResponses<
  typeof contracts.projects.getTestingAgentByIdOrName
>;

export async function getTestingAgentByIdOrName(
  req: GetProjectAgentTemplateRequest
): Promise<GetProjectAgentTemplateResponse> {
  const organizationId = await getUserOrganizationIdOrThrow();
  const { lookupValue } = req.params;
  const { lookupBy } = req.query;

  const query = [eq(agentTemplates.organizationId, organizationId)];

  if (lookupBy === 'name') {
    query.push(eq(agentTemplates.name, lookupValue));
  } else {
    query.push(eq(agentTemplates.id, lookupValue));
  }

  const testingAgent = await db.query.agentTemplates.findFirst({
    where: and(...query),
    columns: {
      id: true,
      name: true,
      updatedAt: true,
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
      id: testingAgent.id,
      name: testingAgent.name,
      updatedAt: testingAgent.updatedAt.toISOString(),
    },
  };
}

type GetDeployedAgentsCountByDeployedAgentTemplateRequest = ServerInferRequest<
  typeof contracts.projects.getDeployedAgentsCountByDeployedAgentTemplate
>;

type GetDeployedAgentsCountByDeployedAgentTemplateResponse =
  ServerInferResponses<
    typeof contracts.projects.getDeployedAgentsCountByDeployedAgentTemplate
  >;

export async function getDeployedAgentsCountByDeployedAgentTemplate(
  req: GetDeployedAgentsCountByDeployedAgentTemplateRequest
): Promise<GetDeployedAgentsCountByDeployedAgentTemplateResponse> {
  const organizationId = await getUserOrganizationIdOrThrow();
  const { projectId } = req.params;
  const { deployedAgentTemplateId } = req.query;

  const [result] = await db
    .select({ count: count() })
    .from(deployedAgents)
    .where(
      and(
        eq(deployedAgents.organizationId, organizationId),
        eq(deployedAgents.projectId, projectId),
        eq(deployedAgents.deployedAgentTemplateId, deployedAgentTemplateId)
      )
    );

  return {
    status: 200,
    body: {
      count: result.count,
    },
  };
}

type ForkAgentTemplateRequest = ServerInferRequest<
  typeof contracts.projects.forkAgentTemplate
>;

type ForkAgentTemplateResponse = ServerInferResponses<
  typeof contracts.projects.forkAgentTemplate
>;

export async function forkAgentTemplate(
  req: ForkAgentTemplateRequest
): Promise<ForkAgentTemplateResponse> {
  const { agentTemplateId, projectId } = req.params;
  const { organizationId, lettaAgentsId } = await getUserOrThrow();

  const testingAgent = await db.query.agentTemplates.findFirst({
    where: and(
      eq(agentTemplates.organizationId, organizationId),
      eq(agentTemplates.projectId, projectId),
      eq(agentTemplates.id, agentTemplateId)
    ),
  });

  if (!testingAgent) {
    return {
      status: 404,
      body: {},
    };
  }

  const copiedAgent = await copyAgentById(testingAgent.id, lettaAgentsId);

  if (!copiedAgent.id) {
    return {
      status: 500,
      body: {
        message: 'Failed to copy agent',
      },
    };
  }

  const name = capitalize(`Forked ${testingAgent.name}`);

  const [agent] = await db
    .insert(agentTemplates)
    .values({
      id: copiedAgent.id,
      projectId: testingAgent.projectId,
      organizationId,
      name,
    })
    .returning({
      id: agentTemplates.id,
    });

  return {
    status: 201,
    body: {
      id: agent.id,
      name,
      updatedAt: new Date().toISOString(),
    },
  };
}

type UpdateProjectRequest = ServerInferRequest<
  typeof contracts.projects.updateProject
>;

type UpdateProjectResponse = ServerInferResponses<
  typeof contracts.projects.updateProject
>;

export async function updateProject(
  req: UpdateProjectRequest
): Promise<UpdateProjectResponse> {
  const { projectId } = req.params;
  const organizationId = await getUserOrganizationIdOrThrow();
  const { name } = req.body;

  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.organizationId, organizationId)
    ),
  });

  if (!project) {
    return {
      status: 404,
      body: {},
    };
  }

  await db
    .update(projects)
    .set({
      name,
    })
    .where(eq(projects.id, projectId));

  return {
    status: 200,
    body: {
      name: name || project.name,
      id: project.id,
      slug: project.slug,
    },
  };
}

type DeleteProjectRequest = ServerInferRequest<
  typeof contracts.projects.deleteProject
>;

type DeleteProjectResponse = ServerInferResponses<
  typeof contracts.projects.deleteProject
>;

export async function deleteProject(
  req: DeleteProjectRequest
): Promise<DeleteProjectResponse> {
  const { projectId } = req.params;
  const organizationId = await getUserOrganizationIdOrThrow();

  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.organizationId, organizationId)
    ),
  });

  if (!project) {
    return {
      status: 404,
      body: {},
    };
  }

  await db.delete(projects).where(eq(projects.id, projectId));

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

export const projectsRouter = {
  getProjects,
  getProjectByIdOrSlug,
  getProjectAgentTemplates,
  createProject,
  createProjectAgentTemplate,
  updateProjectAgentTemplate,
  deleteProjectAgentTemplate,
  getProjectDeployedAgentTemplates,
  getProjectDeployedAgentTemplate,
  getTestingAgentByIdOrName,
  getDeployedAgentsCountByDeployedAgentTemplate,
  forkAgentTemplate,
  updateProject,
  deleteProject,
  getDeployedAgents,
};
