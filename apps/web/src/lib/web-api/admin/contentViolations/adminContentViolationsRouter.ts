import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import { db } from '@letta-cloud/service-database';

type AdminGetContentViolationsRequest = ServerInferRequest<
  typeof contracts.admin.contentViolations.adminGetContentViolations
>;

type AdminGetContentViolationsResponse = ServerInferResponses<
  typeof contracts.admin.contentViolations.adminGetContentViolations
>;

async function adminGetContentViolations(
  req: AdminGetContentViolationsRequest,
): Promise<AdminGetContentViolationsResponse> {
  const { limit = 10, offset = 0 } = req.query;

  const violations = await db.query.contentModerationViolations.findMany({
    offset,
    limit: limit + 1,
    with: {
      organization: {
        columns: {
          name: true,
        },
      },
    },
  });

  const hasNextPage = violations.length > limit;

  return {
    status: 200,
    body: {
      violations: violations.slice(0, limit).map((violation) => ({
        id: violation.id,
        content: violation.content,
        reasons: violation.reasons?.data || [],
        organizationId: violation.organizationId,
        organizationName: violation.organization.name,
        flaggedAt: violation.createdAt.toISOString(),
      })),
      hasNextPage,
    },
  };
}

export const adminContentViolationsRouter = {
  adminGetContentViolations,
};
