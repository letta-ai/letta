import { Client, Connection } from '@temporalio/client';
import { environment } from '@letta-cloud/config-environment-variables';
import { getTemporalConnectionConfig } from '@letta-cloud/utils-server';

const client: Client = makeClient();

function makeClient(): Client {
  const connection = Connection.lazy(getTemporalConnectionConfig());

  return new Client({
    connection,
    namespace: environment.TEMPORAL_LETTUCE_NAMESPACE || 'lettuce.tmhou',
  });
}

export function getTemporalClient(): Client {
  return client;
}
