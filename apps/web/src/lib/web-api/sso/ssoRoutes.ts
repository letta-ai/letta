import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/web-api-client';
import { db, organizationSSOConfiguration } from '@letta-cloud/database';
import { eq } from 'drizzle-orm';
import { WorkOS } from '@workos-inc/node';
import { environment } from '@letta-cloud/environmental-variables';

type VerifySSOEmailResponse = ServerInferResponses<
  typeof contracts.sso.verifySSOEmail
>;

type VerifySSOEmailRequest = ServerInferRequest<
  typeof contracts.sso.verifySSOEmail
>;

async function verifySSOEmail(
  request: VerifySSOEmailRequest,
): Promise<VerifySSOEmailResponse> {
  const { email } = request.body;

  const workos = new WorkOS(process.env.WORKOS_API_KEY);
  const clientId = process.env.WORKOS_CLIENT_ID || '';

  const domain = email.split('@')[1];

  const response = await db.query.organizationSSOConfiguration.findFirst({
    where: eq(organizationSSOConfiguration.domain, domain),
  });

  if (!response) {
    return {
      status: 404,
      body: {
        errorCode: 'invalidSSO',
      },
    };
  }

  const authorizationUrl = workos.sso.getAuthorizationUrl({
    organization: response.workOSOrganizationId,
    redirectUri: `${environment.NEXT_PUBLIC_CURRENT_HOST}/auth/workos-sso/callback`,
    clientId,
  });

  return {
    status: 200,
    body: {
      redirectUrl: authorizationUrl,
    },
  };
}

export const ssoRoutes = {
  verifySSOEmail,
};
