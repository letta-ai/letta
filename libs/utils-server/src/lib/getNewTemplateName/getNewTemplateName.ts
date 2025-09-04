import { db, lettaTemplates, type TxType } from '@letta-cloud/service-database';
import { and, eq } from 'drizzle-orm';
import { findUniqueAgentTemplateName } from '@letta-cloud/utils-server';

interface GetNewTemplateNameProps {
  projectId: string;
  organizationId: string;
  suggestedName?: string;
  allowNameOverride?: boolean;
  tx?: TxType;
}

export const GET_NEW_TEMPLATE_NAME_ERRORS = {
  NAME_MUST_BE_ALPHANUMERIC: 'Name must be alphanumeric',
  NAME_ALREADY_EXISTS: 'Name already exists',
}

export async function getNewTemplateName(
  props: GetNewTemplateNameProps,
): Promise<string> {
  const { projectId, organizationId, suggestedName, allowNameOverride } = props;

  async function executeWithTransaction(_transaction: TxType): Promise<string> {
    if (suggestedName) {
      if (!/^[a-zA-Z0-9_-]+$/.test(suggestedName)) {
        throw new Error(GET_NEW_TEMPLATE_NAME_ERRORS.NAME_MUST_BE_ALPHANUMERIC);
      }

      const exists = await db.query.lettaTemplates.findFirst({
        where: and(
          eq(lettaTemplates.organizationId, organizationId),
          eq(lettaTemplates.projectId, projectId),
          eq(lettaTemplates.name, suggestedName),
        ),
      });

      if (exists) {
        if (allowNameOverride) {
          return findUniqueAgentTemplateName();
        } else {
          throw new Error(GET_NEW_TEMPLATE_NAME_ERRORS.NAME_ALREADY_EXISTS);
        }
      }

      return suggestedName;
    }

    return findUniqueAgentTemplateName();
  }

  if (props.tx) {
    return executeWithTransaction(props.tx);
  } else {
    return db.transaction((tx) => executeWithTransaction(tx));
  }
}
