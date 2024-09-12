import {
  Button,
  Card,
  Frame,
  HStack,
  Typography,
  VStack,
} from '@letta-web/component-library';
import React from 'react';
import { DeployAgentUsageInstructions } from '$letta/client/code-reference/deploy-agent-reference';
import { useCurrentProjectId } from '../hooks';
import type { SourceAgentType } from '$letta/web-api/contracts/projects';

interface DeployedAgentCardProps {
  agent: SourceAgentType;
}

export function SourceAgentCard(props: DeployedAgentCardProps) {
  const { agent } = props;
  const {
    status,
    version,
    deployedAgentCount,
    name,
    createdAt: deployedAt,
    id,
  } = agent;
  const projectId = useCurrentProjectId();
  const [open, setOpen] = React.useState(false);

  return (
    <Card>
      <VStack gap="large">
        <HStack justify="spaceBetween">
          <HStack gap="medium" align="center">
            <div
              className={`rounded-full ${
                status === 'live' ? 'bg-green-400' : 'bg-red-400'
              } w-[10px] h-[10px]`}
            />
            <VStack gap={false} justify="start">
              <Typography align="left" bold>
                {name} (version: {version})
              </Typography>
              <Typography color="muted" variant="body2">
                Deployed at {deployedAt}
              </Typography>
            </VStack>
          </HStack>
          <HStack align="center">
            <Button
              href={`/projects/${projectId}/deployments?stagingAgentId=${id}&stagingAgentName=${name}`}
              color="tertiary-transparent"
              label={`View Deployed Agents (${deployedAgentCount})`}
            />

            <Button
              active={open}
              onClick={() => setOpen((v) => !v)}
              color="tertiary"
              label={open ? 'Hide Instructions' : 'Deployment Instructions'}
            />
          </HStack>
        </HStack>
        {open && (
          <Frame border padding="large" rounded>
            <DeployAgentUsageInstructions sourceAgentId={id} />
          </Frame>
        )}
      </VStack>
    </Card>
  );
}
