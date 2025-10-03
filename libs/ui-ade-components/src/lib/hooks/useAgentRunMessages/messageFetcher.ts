import type {
  LettaMessageUnion,
  Run,
} from '@letta-cloud/sdk-core';

interface FetchRunsOptions {
  agentId: string;
  after?: string | null;
  limit?: number;
  signal?: AbortSignal;
  baseUrl: string;
  headers: Record<string, string>;
}

interface FetchMessagesForRunOptions {
  runId: string;
  after?: string | null;
  limit?: number;
  signal?: AbortSignal;
  baseUrl: string;
  headers: Record<string, string>;
}

/**
 * Fetches runs for a given agent with pagination support
 */
export async function fetchRuns(
  options: FetchRunsOptions,
): Promise<Run[]> {
  const { agentId, after, limit = 50, signal, baseUrl, headers } = options;

  // Build query parameters
  const params = new URLSearchParams({
    agent_id: agentId,
    limit: limit.toString(),
    order: 'desc',
  });

  if (after) {
    params.append('after', after);
  }

  const url = `${baseUrl}/v1/runs?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch runs: ${response.status} ${response.statusText}`);
  }

  const runs: Run[] = await response.json();
  return runs;
}

/**
 * Fetches messages for a given run with pagination support
 */
export async function fetchMessagesForRun(
  options: FetchMessagesForRunOptions,
): Promise<LettaMessageUnion[]> {
  const { runId, after, limit = 50, signal, baseUrl, headers } = options;

  // Build query parameters
  const params = new URLSearchParams({
    limit: limit.toString(),
    order: 'asc', // Oldest first for messages
  });

  if (after) {
    params.append('after', after);
  }

  const url = `${baseUrl}/v1/runs/${runId}/messages?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch messages for run: ${response.status} ${response.statusText}`);
  }

  const messages: LettaMessageUnion[] = await response.json();
  return messages;
}
