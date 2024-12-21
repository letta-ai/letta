import {
  adjectives,
  colors,
  animals,
  uniqueNamesGenerator,
} from 'unique-names-generator';
import { agentTemplates, db } from '@letta-web/database';
import { eq } from 'drizzle-orm';

export async function findUniqueAgentTemplateName(deep = 0) {
  const name = uniqueNamesGenerator({
    dictionaries: [adjectives, colors, animals],
    length: 3,
    separator: '-',
  });

  const existingAgent = await db.query.agentTemplates.findFirst({
    where: eq(agentTemplates.name, name),
  });

  if (existingAgent && deep < 10) {
    return findUniqueAgentTemplateName(deep + 1);
  }

  if (deep >= 10) {
    return `${name}-${new Date().getTime()}`;
  }

  return name;
}
