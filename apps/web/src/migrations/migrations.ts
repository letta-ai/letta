import { db, functionalMigrations } from '@letta-cloud/database';
import { eq } from 'drizzle-orm';
import { myFirstMigration } from './my-first-migration';
import { deployedAgentMigration } from './deployed-agent-migration';

const migrations: Array<() => Promise<any>> = [
  myFirstMigration,
  deployedAgentMigration,
];

export async function handleMigrations() {
  const functionMigrationStore = await db.query.functionalMigrations.findFirst({
    where: eq(functionalMigrations.singleId, 'migrations'),
  });

  const currentVersion = parseInt(functionMigrationStore?.version || '0', 10);

  await Promise.all(
    migrations.slice(currentVersion).map(async (migration) => {
      await migration();
    }),
  );

  const nextVersion = migrations.length.toString();

  await db
    .insert(functionalMigrations)
    .values({
      singleId: 'migrations',
      version: nextVersion,
    })
    .onConflictDoUpdate({
      target: [functionalMigrations.singleId],
      set: {
        version: nextVersion,
      },
    });
}
