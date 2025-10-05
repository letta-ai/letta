import type { Run } from '@letta-cloud/sdk-core';

interface RunMonitorFactoryOptions {
  agentId: string;
  baseUrl: string;
  headers: Record<string, string>;
  onUpdate: (runs: Run[]) => void;
  pollingInterval?: number; // in milliseconds, defaults to 2000 (2 seconds)
}

interface RunMonitor {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
}

/**
 * Creates a run monitor that continuously polls the runs endpoint
 * and updates the last 20 runs to detect status changes (including active -> inactive transitions).
 * Polls GET /v1/runs?agent_id={agentId}&limit=20
 */
export function createRunMonitorFactory(options: RunMonitorFactoryOptions): RunMonitor {
  const { agentId, baseUrl, headers, onUpdate, pollingInterval = 2000 } = options;

  let timeoutId: NodeJS.Timeout | null = null;
  let isMonitoring = false;
  let abortController: AbortController | null = null;

  /**
   * Fetches the last 20 runs for the agent from the API
   * Checks all runs to detect both active runs and transitions to inactive status
   */
  async function fetchRecentRuns(): Promise<Run[]> {
    try {
      // Build query parameters for recent runs
      const params = new URLSearchParams({
        agent_id: agentId,
        limit: '20',
        order: 'desc',
      });

      const url = `${baseUrl}/v1/runs?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        signal: abortController?.signal,
      });

      if (!response.ok) {
        console.error(`Failed to fetch recent runs: ${response.status} ${response.statusText}`);
        return [];
      }

      const runs: Run[] = await response.json();
      return runs;
    } catch (error) {
      // Don't log abort errors as they're expected when stopping
      if (error instanceof Error && error.name === 'AbortError') {
        return [];
      }
      console.error('Error fetching recent runs:', error);
      return [];
    }
  }

  /**
   * Polling function that checks recent runs and schedules the next poll
   */
  async function poll(): Promise<void> {
    if (!isMonitoring) {
      return;
    }

    const runs = await fetchRecentRuns();

    onUpdate(runs);

    // Schedule next poll after the current one completes
    if (isMonitoring) {
      timeoutId = setTimeout(poll, pollingInterval);
    }
  }

  /**
   * Starts the polling monitor
   */
  function start(): void {
    if (isMonitoring) {
      return;
    }

    isMonitoring = true;
    abortController = new AbortController();

    // Start polling (first poll happens immediately, then schedules next)
    poll();
  }

  /**
   * Stops the polling monitor
   */
  function stop(): void {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    isMonitoring = false;
  }

  /**
   * Returns whether the monitor is currently running
   */
  function isRunning(): boolean {
    return isMonitoring;
  }

  return {
    start,
    stop,
    isRunning,
  };
}
