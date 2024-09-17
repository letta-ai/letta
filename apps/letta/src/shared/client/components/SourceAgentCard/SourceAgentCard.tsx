'use client';
import * as React from 'react';
import { DeployAgentUsageInstructions } from '$letta/client/code-reference/deploy-agent-reference';
import {
  ActionCard,
  Badge,
  Button,
  HStack,
} from '@letta-web/component-library';

interface SourceAgentCardProps {
  version: string;
  createdAt: string;
  agentKey: string;
  currentProjectId: string;
  variant?: 'compact' | 'default';
  deploymentInstructions?: React.ReactNode;
}

export function SourceAgentCard(props: SourceAgentCardProps) {
  const { version, createdAt, agentKey, variant, currentProjectId } = props;
  const [showDeploymentInstructions, setShowDeploymentInstructions] =
    React.useState(false);

  return (
    <ActionCard
      mainAction={
        <HStack>
          <Button
            size={variant === 'compact' ? 'small' : 'default'}
            color="tertiary"
            onClick={() => {
              setShowDeploymentInstructions((v) => !v);
            }}
            active={showDeploymentInstructions}
            label="Instructions"
          />
          <Button
            target="_blank"
            color="tertiary"
            size={variant === 'compact' ? 'small' : 'default'}
            label="Deployed Agents"
            href={`/projects/${currentProjectId}/deployments?stagingAgentKey=${agentKey}`}
          />
        </HStack>
      }
      title={agentKey}
      subtitle={`Staged at ${createdAt}`}
      icon={<Badge content={`v${version}`} />}
    >
      {showDeploymentInstructions && (
        <DeployAgentUsageInstructions
          sourceAgentKey={agentKey}
          projectId={currentProjectId}
        />
      )}
    </ActionCard>
  );
}
