import type { DesktopConfigSchemaType } from '@letta-cloud/types';

export function getIsSQLLiteConfig(config: DesktopConfigSchemaType) {
  return (
    config.databaseConfig?.type === 'embedded' &&
    config.databaseConfig.embeddedType === 'sqlite'
  );
}
