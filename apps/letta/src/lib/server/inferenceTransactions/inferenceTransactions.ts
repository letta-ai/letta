import { db, deployedAgents, inferenceTransactions } from '@letta-web/database';
import { AgentsService } from '@letta-web/letta-agents-api';
import { eq } from 'drizzle-orm';
import { trackServerSideEvent } from '@letta-web/analytics/server';
import { AnalyticsEvent } from '@letta-web/analytics';

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

  const [agent, maybeDeployedAgent] = await Promise.all([
    AgentsService.getAgent({
      agentId,
    }),
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
