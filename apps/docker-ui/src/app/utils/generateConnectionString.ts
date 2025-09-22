import type { DatabaseConnectionPayload } from '../pages/SetupProvider/ConfigureExternalDatabaseStep/ConfigureExternalDatabaseStep';

export function generateConnectionString(payload: DatabaseConnectionPayload) {
  let base = 'postgresql://';

  if (payload.username) {
    base += `${payload.username}:`;
  }

  if (payload.password) {
    base += `${payload.password}@`;
  }

  if (payload.host) {
    base += payload.host;
  }

  if (payload.port) {
    base += `:${payload.port}`;
  }

  if (payload.databaseName) {
    base += `/${payload.databaseName}`;
  }

  return base;
}
