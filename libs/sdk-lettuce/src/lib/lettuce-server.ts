import { NativeConnection, Worker } from '@temporalio/worker';
import { activities } from './activities';
import { TASK_QUEUE_NAME } from './config';

export async function startLettuceServer() {
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_API_HOST,
  });

  try {
    const worker = await Worker.create({
      connection,
      namespace: 'default',
      taskQueue: TASK_QUEUE_NAME,
      // Workflows are registered using a path as they run in a separate JS context.
      workflowsPath: require.resolve('./workflows/index.ts'),
      activities,
    });

    // Step 3: Start accepting tasks on the Task Queue specified in TASK_QUEUE_NAME
    //
    // The worker runs until it encounters an unexpected error or the process receives a shutdown signal registered on
    // the SDK Runtime object.
    //
    // By default, worker logs are written via the Runtime logger to STDERR at INFO level.
    //
    // See https://typescript.temporal.io/api/classes/worker.Runtime#install to customize these defaults.
    await worker.run();
  } finally {
    await connection.close();
  }
}
