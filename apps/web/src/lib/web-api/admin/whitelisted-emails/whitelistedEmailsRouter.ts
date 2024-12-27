import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$web/web-api/contracts';
import { db, emailWhitelist } from '@letta-web/database';
import { eq, ilike } from 'drizzle-orm';

type GetWhitelistedEmailsResponse = ServerInferResponses<
  typeof contracts.admin.whitelistedEmails.getWhitelistedEmails
>;
type GetWhitelistedEmailsQuery = ServerInferRequest<
  typeof contracts.admin.whitelistedEmails.getWhitelistedEmails
>;

export async function getWhitelistedEmails(
  req: GetWhitelistedEmailsQuery
): Promise<GetWhitelistedEmailsResponse> {
  const { offset, limit = 10, search } = req.query;
  const where = search ? ilike(emailWhitelist.email, search) : undefined;

  const response = await db.query.emailWhitelist.findMany({
    offset,
    limit: limit + 1,
    where: where,
  });

  return {
    status: 200,
    body: {
      emails: response.slice(0, limit).map((email) => ({
        id: email.id,
        email: email.email,
      })),
      hasNextPage: response.length > limit,
    },
  };
}

type CreateWhitelistedEmailRequest = ServerInferRequest<
  typeof contracts.admin.whitelistedEmails.createWhitelistedEmail
>;
type CreateWhitelistedEmailResponse = ServerInferResponses<
  typeof contracts.admin.whitelistedEmails.createWhitelistedEmail
>;

export async function createWhitelistedEmail(
  req: CreateWhitelistedEmailRequest
): Promise<CreateWhitelistedEmailResponse> {
  const { email } = req.body;
  const [response] = await db
    .insert(emailWhitelist)
    .values({ email })
    .returning({
      id: emailWhitelist.id,
      email: emailWhitelist.email,
    });

  return {
    status: 201,
    body: {
      id: response.id,
      email: response.email,
    },
  };
}

type DeleteWhitelistedEmailRequest = ServerInferRequest<
  typeof contracts.admin.whitelistedEmails.deleteWhitelistedEmail
>;
type DeleteWhitelistedEmailResponse = ServerInferResponses<
  typeof contracts.admin.whitelistedEmails.deleteWhitelistedEmail
>;

export async function deleteWhitelistedEmail(
  req: DeleteWhitelistedEmailRequest
): Promise<DeleteWhitelistedEmailResponse> {
  await db
    .delete(emailWhitelist)
    .where(eq(emailWhitelist.id, req.params.whitelistedEmailId));
  return {
    status: 204,
    body: null,
  };
}
