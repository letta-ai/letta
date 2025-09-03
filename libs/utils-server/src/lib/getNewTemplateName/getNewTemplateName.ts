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

export async function getNewTemplateName(
  props: GetNewTemplateNameProps,
): Promise<string> {
  const { projectId, organizationId, suggestedName, allowNameOverride } = props;

  async function executeWithTransaction(_transaction: TxType): Promise<string> {
    if (suggestedName) {
      if (!/^[a-zA-Z0-9_-]+$/.test(suggestedName)) {
        throw new Error('Name must be alphanumeric');
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
          throw new Error('Name already exists');
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
