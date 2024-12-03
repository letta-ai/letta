/* Get Environment Variables */
import type { contracts } from '$letta/web-api/contracts';
import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import { getUserOrThrow } from '$letta/server/auth';
import { SandboxConfigService } from '@letta-web/letta-agents-api';
import { HIDDEN_ENVIRONMENT_VARIABLES } from '$letta/web-api/environment-variables/environmentVariablesContracts';

async function getE2BSandboxConfigIdByLettaUserId(lettaUserId: string) {
  let configId = '';

  const sandboxes =
    await SandboxConfigService.listSandboxConfigsV1SandboxConfigGet(
      {
        userId: lettaUserId,
      },
      {
        user_id: lettaUserId,
      }
    );

  configId = sandboxes.find((sandbox) => sandbox.type === 'e2b')?.id || '';

  if (!configId) {
    const newConfig =
      await SandboxConfigService.createDefaultE2bSandboxConfigV1SandboxConfigE2bDefaultPost(
        {
          userId: lettaUserId,
        },
        {
          user_id: lettaUserId,
        }
      );
    configId = newConfig.id || configId;
  }

  if (!configId) {
    throw new Error('Failed to create a new sandbox config');
  }

  return configId;
}

async function listSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGet(
  lettaAgentUserId: string,
  sandboxConfigId: string
) {
  return SandboxConfigService.listSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGet(
    {
      sandboxConfigId,
      limit: MAX_ENVIRONMENT_VARIABLES,
    },
    {
      user_id: lettaAgentUserId,
    }
  );
}

export type GetEnvironmentVariableByKeyResponse = ServerInferResponses<
  typeof contracts.environmentVariables.getEnvironmentVariableByKey
>;

export type GetEnvironmentVariableByKeyRequest = ServerInferRequest<
  typeof contracts.environmentVariables.getEnvironmentVariableByKey
>;

async function getEnvironmentVariableByKey(
  req: GetEnvironmentVariableByKeyRequest
): Promise<GetEnvironmentVariableByKeyResponse> {
  const user = await getUserOrThrow();
  const { key } = req.params;

  const sandboxConfigId = await getE2BSandboxConfigIdByLettaUserId(
    user.lettaAgentsId
  );

  const environmentVariables =
    await listSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGet(
      user.lettaAgentsId,
      sandboxConfigId
    );

  const environmentVariable = environmentVariables.find(
    (envVar) => envVar.key === key
  );

  if (!environmentVariable) {
    return {
      status: 404,
      body: {
        message: 'Environment variable not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      id: environmentVariable.id || '',
      key: environmentVariable.key,
    },
  };
}

export type GetEnvironmentVariablesResponse = ServerInferResponses<
  typeof contracts.environmentVariables.getEnvironmentVariables
>;

export type GetEnvironmentVariablesRequest = ServerInferRequest<
  typeof contracts.environmentVariables.getEnvironmentVariables
>;

const MAX_ENVIRONMENT_VARIABLES = 100;

async function getEnvironmentVariables(
  req: GetEnvironmentVariablesRequest
): Promise<GetEnvironmentVariablesResponse> {
  const user = await getUserOrThrow();
  const { search } = req.query;

  const sandboxConfigId = await getE2BSandboxConfigIdByLettaUserId(
    user.lettaAgentsId
  );

  const environmentVariables =
    await listSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGet(
      user.lettaAgentsId,
      sandboxConfigId
    );

  return {
    status: 200,
    body: {
      environmentVariables: environmentVariables
        .filter(
          (envVar) =>
            envVar.key.toLowerCase().includes(search.toLowerCase()) &&
            !HIDDEN_ENVIRONMENT_VARIABLES.includes(envVar.key)
        )
        .map((envVar) => ({
          id: envVar.id || '',
          key: envVar.key,
        })),
      hasNextPage: false,
    },
  };
}

export type SetEnvironmentVariableResponse = ServerInferResponses<
  typeof contracts.environmentVariables.setEnvironmentVariable
>;

export type SetEnvironmentVariableRequest = ServerInferRequest<
  typeof contracts.environmentVariables.setEnvironmentVariable
>;

async function setEnvironmentVariable(
  req: SetEnvironmentVariableRequest
): Promise<SetEnvironmentVariableResponse> {
  const user = await getUserOrThrow();
  const { key, value } = req.body;

  const sandboxConfigId = await getE2BSandboxConfigIdByLettaUserId(
    user.lettaAgentsId
  );

  // first get the existing environment variables
  const existingEnvironmentVariables =
    await listSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGet(
      user.lettaAgentsId,
      sandboxConfigId
    );

  const existingEnvironmentVariable = existingEnvironmentVariables.find(
    (envVar) => envVar.key === key
  );

  if (existingEnvironmentVariable) {
    await SandboxConfigService.updateSandboxEnvVarV1SandboxConfigEnvironmentVariableEnvVarIdPatch(
      {
        envVarId: existingEnvironmentVariable.id || '',
        userId: user.lettaAgentsId,
        requestBody: {
          key,
          value,
        },
      }
    );

    return {
      status: 200,
      body: {
        id: existingEnvironmentVariable.id || '',
        key,
      },
    };
  }

  const filteredEnvironmentVariables = existingEnvironmentVariables.filter(
    (envVar) => !HIDDEN_ENVIRONMENT_VARIABLES.includes(envVar.key)
  );

  if (filteredEnvironmentVariables.length + 1 > MAX_ENVIRONMENT_VARIABLES) {
    return {
      status: 400,
      body: {
        errorCode: 'maxEnvironmentVariablesReached',
        message: `You can only have ${MAX_ENVIRONMENT_VARIABLES} environment variables`,
      },
    };
  }

  const newEnvironmentVariable =
    await SandboxConfigService.createSandboxEnvVarV1SandboxConfigSandboxConfigIdEnvironmentVariablePost(
      {
        userId: user.lettaAgentsId,
        sandboxConfigId: sandboxConfigId,
        requestBody: {
          key,
          value,
        },
      },
      {
        user_id: user.lettaAgentsId,
      }
    );

  return {
    status: 201,
    body: {
      id: newEnvironmentVariable.id || '',
      key,
    },
  };
}

export type DeleteEnvironmentVariableResponse = ServerInferResponses<
  typeof contracts.environmentVariables.deleteEnvironmentVariable
>;

export type DeleteEnvironmentVariableRequest = ServerInferRequest<
  typeof contracts.environmentVariables.deleteEnvironmentVariable
>;

async function deleteEnvironmentVariable(
  req: DeleteEnvironmentVariableRequest
): Promise<DeleteEnvironmentVariableResponse> {
  const user = await getUserOrThrow();
  const { id } = req.params;

  await SandboxConfigService.deleteSandboxEnvVarV1SandboxConfigEnvironmentVariableEnvVarIdDelete(
    {
      envVarId: id,
      userId: user.lettaAgentsId,
    },
    {
      user_id: user.lettaAgentsId,
    }
  );

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

export const environmentVariablesRouter = {
  getEnvironmentVariables,
  setEnvironmentVariable,
  getEnvironmentVariableByKey,
  deleteEnvironmentVariable,
};
