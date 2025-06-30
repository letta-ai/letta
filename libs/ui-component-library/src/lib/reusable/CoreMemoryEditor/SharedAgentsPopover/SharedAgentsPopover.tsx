import { useTranslations } from '@letta-cloud/translations';
import type { AgentState } from '@letta-cloud/sdk-core';
import { HStack } from '../../../framing/HStack/HStack';
import { LettaAgentTypeIcon } from '../../../core/LettaAgentTypeIcon/LettaAgentTypeIcon';
import { Popover } from '../../../core/Popover/Popover';
import { Typography } from '../../../core/Typography/Typography';
import { VStack } from '../../../framing/VStack/VStack';
import { Badge } from '../../../core/Badge/Badge';
import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';
import { ExternalLinkIcon } from '../../../icons';

export interface SharedAgent {
  id: string;
  name: string;
  agentType: AgentState['agent_type'];
  onClick: () => void;
  isCurrentAgent?: boolean;
}

interface AgentBadgeProps {
  isCurrentAgent: boolean;
}

function AgentBadge(props: AgentBadgeProps) {
  const { isCurrentAgent } = props;

  const t = useTranslations('components/SharedMemoryIndicator');

  if (isCurrentAgent) {
    return <Badge content={t('thisAgent')} size="small" />;
  }

  if (CURRENT_RUNTIME === 'letta-desktop') {
    return <div />;
  }

  return <ExternalLinkIcon />;
}

interface SharedMemoryIndicatorProps {
  agents: SharedAgent[];
  trigger: React.ReactNode;
}

export function SharedAgentsPopover(props: SharedMemoryIndicatorProps) {
  const { agents, trigger } = props;

  if (!agents?.length) {
    return null;
  }

  if (agents.length === 1) {
    return null;
  }

  return (
    <Popover trigger={trigger} align="start">
      <VStack color="background-grey" gap={false}>
        {agents.map((agent, index) => {
          const { isCurrentAgent, onClick } = agent;

          return (
            <HStack
              padding="small"
              fullWidth
              align="center"
              borderBottom={index !== agents.length - 1 ? true : undefined}
              key={agent.id}
              onClick={onClick}
              as="button"
            >
              <LettaAgentTypeIcon type={agent.agentType} />
              <VStack collapseWidth flex gap={false}>
                <Typography
                  overrideEl="span"
                  noWrap
                  bold
                  overflow="ellipsis"
                  fullWidth
                  variant="body3"
                >
                  {agent.name}
                </Typography>
                <Typography
                  noWrap
                  overrideEl="span"
                  overflow="ellipsis"
                  fullWidth
                  variant="body4"
                >
                  {agent.id}
                </Typography>
              </VStack>
              <AgentBadge isCurrentAgent={!!isCurrentAgent} />
            </HStack>
          );
        })}
      </VStack>
    </Popover>
  );
}
