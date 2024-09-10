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

interface DeployedAgentCardProps {
  status: 'live' | 'offline';
  name: string;
  id: string;
  deployedAt: string;
}

export function SourceAgentCard(props: DeployedAgentCardProps) {
  const { status, name, deployedAt, id } = props;
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
                {name}
              </Typography>
              <Typography color="muted" variant="body2">
                Deployed at {deployedAt}
              </Typography>
            </VStack>
          </HStack>
          <HStack align="center">
            <Button
              href={`/projects/${id}/deployments/${id}`}
              color="tertiary-transparent"
              label="View Deployed Agents"
            />

            <Button
              active={open}
              onClick={() => setOpen((v) => !v)}
              color="tertiary"
              label={open ? 'Hide Instructions' : 'Usage Instructions'}
            />
          </HStack>
        </HStack>
        {open && (
          <Frame border padding="small" rounded>
            <DeployAgentUsageInstructions sourceAgentId={id} />
          </Frame>
        )}
      </VStack>
    </Card>
  );
}
