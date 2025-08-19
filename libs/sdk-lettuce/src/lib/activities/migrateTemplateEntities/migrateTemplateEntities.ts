import type { MigrateTemplateEntitiesPayload } from '../../types';

// This activity is no longer used as the orchestration logic has moved to the workflow
// using child workflows instead. Kept for compatibility.
export async function migrateTemplateEntities(
  _payload: MigrateTemplateEntitiesPayload,
): Promise<{ successful: number; failed: number; total: number }> {
  console.warn(
    'migrateTemplateEntities activity is deprecated. Use migrateTemplateEntitiesWorkflow instead.',
  );

  // Return empty result as this activity should not be called anymore
  return { successful: 0, failed: 0, total: 0 };
}
