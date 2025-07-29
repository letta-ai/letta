import type { DesktopConfigSchemaType } from '@letta-cloud/types';

export function getIsEmbeddedPostgres(config: DesktopConfigSchemaType) {
  return (
    config.databaseConfig?.type === 'embedded' &&
    config.databaseConfig.embeddedType !== 'sqlite'
  );
}

export function getIsLocalServer(config: DesktopConfigSchemaType) {
  return config.databaseConfig?.type === 'local';
}
