/* eslint-disable @typescript-eslint/naming-convention */

import { sleep, check, fail } from 'k6';
import type { Options } from 'k6/options';
import http from 'k6/http';
import { DEFAULT_SERVER, DEFAULT_HEADERS } from './config';

export const options: Options = {
  vus: 50,
  duration: '10s',
};

function createAgent(): string {
  const res = http.post(
    `${DEFAULT_SERVER}/v1/templates/shubject/tragic-teal-rodent:latest/agents`,
    JSON.stringify({
      agent_name: `test-scale ${__VU}-${__ITER}`,
    }),
    {
      headers: {
        ...DEFAULT_HEADERS,
        'Content-Type': 'application/json',
      },
    },
  );

  check(res, {
    'successfully created agent': () => res.status === 201,
  });

  const data = res.json() as { id: string };

  return data.id || '';
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function sendMessageToAgent(agentId: string) {
  const res = http.post(
    `${DEFAULT_SERVER}/v1/agents/${agentId}/messages`,
    JSON.stringify({
      messages: [{ role: 'user', content: 'Hello' }],
    }),
    {
      headers: {
        ...DEFAULT_HEADERS,
        'Content-Type': 'application/json',
      },
    },
  );

  check(res, {
    'successfully sent message to agent': () => res.status === 200,
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function deleteAgent(agentId: string) {
  if (!agentId) {
    fail('Invalid agent ID');
  }

  const res = http.del(`${DEFAULT_SERVER}/v1/agents/${agentId}`, null, {
    headers: DEFAULT_HEADERS,
  });

  check(res, {
    'successfully deleted agent': () => res.status === 200,
  });

  if (res.status !== 200) {
    fail('Failed to delete agent');
  }
}

export default () => {
  createAgent();

  // sendMessageToAgent(agentId);

  // deleteAgent(agentId);

  sleep(1);
};
