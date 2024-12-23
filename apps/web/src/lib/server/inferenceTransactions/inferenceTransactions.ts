import {
  db,
  deployedAgents,
  inferenceTransactions,
  users,
} from '@letta-web/database';
import { AgentsService } from '@letta-web/letta-agents-api';
import { eq } from 'drizzle-orm';
import { trackServerSideEvent } from '@letta-web/analytics/server';
import { AnalyticsEvent } from '@letta-web/analytics';
import * as Sentry from '@sentry/node';

interface CreateInferenceTransactionOptions {
  referenceId: string;
  agentId: string;
  stepCount: number;
  inputTokens: number;
  totalTokens: number;
  outputTokens: number;
  source: string;
  organizationId: string;
  startedAt: Date;
  endedAt: Date;
  path: string;
}

export async function createInferenceTransaction(
  options: CreateInferenceTransactionOptions
) {
  const {
    referenceId,
    stepCount,
    inputTokens,
    totalTokens,
    endedAt,
    outputTokens,
    source,
    startedAt,
    organizationId,
    agentId,
    path,
  } = options;

  const user = await db.query.users.findFirst({
    where: eq(users.activeOrganizationId, organizationId),
  });

  if (!user) {
    Sentry.captureException(
      new Error('Could not complete inference transaction due to missing user')
    );
    return;
  }

  const [agent, maybeDeployedAgent] = await Promise.all([
    AgentsService.getAgent(
      {
        agentId,
      },
      {
        user_id: user.lettaAgentsId,
      }
    ),
    db.query.deployedAgents
      .findFirst({
        where: eq(deployedAgents.id, agentId),
      })
      .catch(() => null),
  ]);

  await db.insert(inferenceTransactions).values({
    referenceId,
    agentId,
    organizationId,
    source,
    projectId: maybeDeployedAgent?.projectId,
    inputTokens: inputTokens.toString(),
    outputTokens: outputTokens.toString(),
    totalTokens: totalTokens.toString(),
    stepCount: stepCount.toString(),
    providerType: agent.llm_config.model_endpoint_type || '',
    providerEndpoint: agent.llm_config.model_endpoint || '',
    providerModel: agent.llm_config.model || '',
    startedAt,
    endedAt,
  });

  trackServerSideEvent(AnalyticsEvent.INFERENCE_TRANSACTION_COMPLETED, {
    organizationId,
    model: agent.llm_config.model || '',
    route: path,
    inferenceTime: endedAt.getTime() - startedAt.getTime(),
    totalTokens,
  });
}
