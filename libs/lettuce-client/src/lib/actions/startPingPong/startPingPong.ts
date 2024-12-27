import { getTemporalClient } from '../../../index';
import { ping } from '../../workflows/ping/ping';
import { nanoid } from 'nanoid';
import { TASK_QUEUE_NAME } from '../../config';

export async function startPingPong(name: string) {
  const handle = await getTemporalClient().workflow.start(ping, {
    taskQueue: TASK_QUEUE_NAME,
    args: [name],
    workflowId: 'ping-' + nanoid(),
  });
  return handle.result();
}
