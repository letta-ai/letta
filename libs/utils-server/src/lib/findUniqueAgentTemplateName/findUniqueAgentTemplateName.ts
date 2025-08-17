import {
  adjectives,
  colors,
  animals,
  uniqueNamesGenerator,
} from 'unique-names-generator';
import { lettaTemplates, db } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';

export async function findUniqueAgentTemplateName(deep = 0) {
  const name = uniqueNamesGenerator({
    dictionaries: [adjectives, colors, animals],
    length: 3,
    separator: '-',
  });

  const existingTemplate = await db.query.lettaTemplates.findFirst({
    where: eq(lettaTemplates.name, name),
  });

  if (existingTemplate && deep < 10) {
    return findUniqueAgentTemplateName(deep + 1);
  }

  if (deep >= 10) {
    return `${name}-${new Date().getTime()}`;
  }

  return name;
}
