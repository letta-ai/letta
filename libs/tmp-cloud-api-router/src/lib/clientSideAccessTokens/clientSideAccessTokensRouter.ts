import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';

import type { cloudContracts } from '@letta-cloud/sdk-cloud-api';
import type { SDKContext } from '../types';
import { getContextDataHack } from '../getContextDataHack/getContextDataHack';
import {
  deleteClientSideAPIKey,
  generateClientSideAPIKey,
} from '@letta-cloud/service-auth';

type CreateClientSideAccessTokenRequest = ServerInferRequest<
  typeof cloudContracts.clientSideAccessTokens.createClientSideAccessToken
>;

type CreateClientSideAccessTokenResponse = ServerInferResponses<
  typeof cloudContracts.clientSideAccessTokens.createClientSideAccessToken
>;

export async function createClientSideAccessToken(
  req: CreateClientSideAccessTokenRequest,
  context: SDKContext,
): Promise<CreateClientSideAccessTokenResponse> {
  const { organizationId, userId } = getContextDataHack(req, context);

  const { body } = req;

  const {
    expires_at: expiresAtBase,
    policy,
    hostname,
    // expire_other_tokens: expireOtherTokens,
  } = body;

  const expiresAt =
    expiresAtBase && !Number.isNaN(Date.parse(expiresAtBase))
      ? new Date(expiresAtBase)
      : new Date(Date.now() + 5 * 60 * 1000);

  const token = await generateClientSideAPIKey({
    organizationId,
    hostname,
    expiresAt,
    userId,
    policy: {
      version: '1',
      data: policy,
    },
  });

  return {
    status: 201,
    body: {
      token,
      hostname,
      expiresAt: expiresAt.toISOString(),
      policy: {
        version: '1',
        data: policy,
      },
    },
  };
}

type DeleteClientSideAccessTokenRequest = ServerInferRequest<
  typeof cloudContracts.clientSideAccessTokens.deleteClientSideAccessToken
>;

type DeleteClientSideAccessTokenResponse = ServerInferResponses<
  typeof cloudContracts.clientSideAccessTokens.deleteClientSideAccessToken
>;

export async function deleteClientSideAccessToken(
  req: DeleteClientSideAccessTokenRequest,
  context: SDKContext,
): Promise<DeleteClientSideAccessTokenResponse> {
  const { organizationId } = getContextDataHack(req, context);

  const { token } = req.params;

  await deleteClientSideAPIKey({
    token,
    organizationId,
  });

  return {
    status: 204,
    body: undefined,
  };
}

export const clientSideAccessTokensRouter = {
  createClientSideAccessToken,
  deleteClientSideAccessToken,
};
