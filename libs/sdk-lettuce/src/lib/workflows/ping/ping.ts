import * as workflow from '@temporalio/workflow';
import type { activities } from '../../activities';

// Load Activities and assign the Retry Policy
const { getPong } = workflow.proxyActivities<typeof activities>({
  retry: {
    initialInterval: '1 second', // amount of time that must elapse before the first retry occurs.
    maximumInterval: '1 minute', // maximum interval between retries.
    backoffCoefficient: 2, // how much the retry interval increases.
    // maximumAttempts: 5, // maximum number of execution attempts. Unspecified means unlimited retries.
  },
  startToCloseTimeout: '1 minute', // maximum time allowed for a single Activity Task Execution.
});

export async function ping(name: string): Promise<string> {
  try {
    const pong = await getPong();

    return `${name}: ${pong}`;
  } catch (_e) {
    throw new workflow.ApplicationFailure('Failed to pong');
  }
}
