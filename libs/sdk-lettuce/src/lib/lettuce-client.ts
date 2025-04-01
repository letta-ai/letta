import { Client, Connection } from '@temporalio/client';
import { environment } from '@letta-cloud/config-environment-variables';
import { getConnectionConfig } from './utils/getConnectionConfig/getConnectionConfig';

const client: Client = makeClient();

function makeClient(): Client {
  const connection = Connection.lazy(getConnectionConfig());

  return new Client({
    connection,
    namespace: environment.TEMPORAL_LETTUCE_NAMESPACE || 'lettuce.tmhou',
  });
}

export function getTemporalClient(): Client {
  return client;
}
