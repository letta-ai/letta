import { db, organizationUsers } from '@letta-cloud/service-database';
import { and, eq } from 'drizzle-orm';

interface GetDefaultContactEmailsOptions {
  organizationId: string;
}

export async function getDefaultContactEmails(
  props: GetDefaultContactEmailsOptions,
) {
  const { organizationId } = props;

  const users = await db.query.organizationUsers.findMany({
    where: and(
      eq(organizationUsers.organizationId, organizationId),
      eq(organizationUsers.role, 'admin'),
    ),
    with: {
      user: {
        columns: {
          email: true,
        },
      },
    },
  });

  return users.map((user) => user.user.email || '').filter((e) => !!e);
}
