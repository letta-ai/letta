import { Client, Connection } from '@temporalio/client';
import { environment } from '@letta-web/environmental-variables';

const client: Client = makeClient();

function makeClient(): Client {
  const connection = Connection.lazy({
    address: environment.TEMPORAL_API_HOST,
  });

  return new Client({ connection });
}

export function getTemporalClient(): Client {
  return client;
}
