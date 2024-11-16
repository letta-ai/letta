import { db, inferenceTransactions } from '@letta-web/database';
import { AgentsService } from '@letta-web/letta-agents-api';

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
  } = options;

  const agent = await AgentsService.getAgent({
    agentId,
  });

  await db.insert(inferenceTransactions).values({
    referenceId,
    agentId,
    organizationId,
    source,
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
}
