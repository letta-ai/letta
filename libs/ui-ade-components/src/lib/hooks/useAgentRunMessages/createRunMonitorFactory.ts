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

  let intervalId: NodeJS.Timeout | null = null;
  let isMonitoring = false;

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
      });

      if (!response.ok) {
        console.error(`Failed to fetch recent runs: ${response.status} ${response.statusText}`);
        return [];
      }

      const runs: Run[] = await response.json();
      return runs;
    } catch (error) {
      console.error('Error fetching recent runs:', error);
      return [];
    }
  }

  /**
   * Polling function that checks recent runs
   */
  async function poll(): Promise<void> {
    const runs = await fetchRecentRuns();

    if (runs.length > 0) {
      // Notify callback with all recent runs (including status transitions)
      onUpdate(runs);
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

    // Initial poll
    poll();

    // Start interval polling
    intervalId = setInterval(poll, pollingInterval);
  }

  /**
   * Stops the polling monitor
   */
  function stop(): void {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
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
