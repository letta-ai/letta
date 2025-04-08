import {
  type Block,
  useBlocksServiceListAgentsForBlock,
} from '@letta-cloud/sdk-core';
import {
  Badge,
  ExternalLinkIcon,
  HStack,
  LettaAgentTypeIcon,
  LettaInvaderIcon,
  Popover,
  Tooltip,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentAgentMetaData } from '../../../hooks';
import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';
import { useADEAppContext } from '../../../AppContext/AppContext';

interface AgentBadgeProps {
  isCurrentAgent: boolean;
}

function AgentBadge(props: AgentBadgeProps) {
  const { isCurrentAgent } = props;

  const t = useTranslations('ADE/SharedMemoryIndicator');

  if (isCurrentAgent) {
    return <Badge content={t('thisAgent')} size="small" />;
  }

  if (CURRENT_RUNTIME === 'letta-desktop') {
    return <div />;
  }

  return <ExternalLinkIcon />;
}

interface SharedMemoryIndicatorProps {
  memory: Block;
}

export function SharedMemoryIndicator(props: SharedMemoryIndicatorProps) {
  const { memory } = props;

  const { push } = useRouter();

  const handleMoveToAgent = useCallback(
    (agentId: string) => {
      if (CURRENT_RUNTIME === 'letta-desktop') {
        push(`/dashboard/agents/${agentId}`);
      }
    },
    [push],
  );

  const { projectSlug } = useADEAppContext();

  const { agentId, isTemplate, isLocal } = useCurrentAgentMetaData();
  const t = useTranslations('ADE/SharedMemoryIndicator');
  const { data: agents } = useBlocksServiceListAgentsForBlock(
    {
      blockId: memory.id || '',
    },
    undefined,
    {
      enabled: !!memory.id,
    },
  );

  const pathUntilAgents = useMemo(() => {
    if (projectSlug) {
      if (!isLocal) {
        return `/projects/${projectSlug}/agents`;
      }

      return `${projectSlug}/agents`;
    }

    return '/agents';
  }, [projectSlug, isLocal]);

  if (isTemplate) {
    // not supported for templates just yet!
    return null;
  }

  if (!agents?.length) {
    return null;
  }

  if (agents.length === 1) {
    return null;
  }

  return (
    <Popover
      trigger={
        <Tooltip asChild content={t('trigger')}>
          <HStack
            color="brand-light"
            paddingX="xxsmall"
            align="center"
            className="w-auto "
            gap="small"
          >
            <LettaInvaderIcon />
            <Typography variant="body3">{agents.length}</Typography>
          </HStack>
        </Tooltip>
      }
      align="start"
    >
      <VStack color="background-grey" gap={false}>
        {agents.map((agent, index) => {
          const isCurrentAgent = agentId === agent.id;

          const payload = (() => {
            if (isCurrentAgent) {
              return {};
            }

            if (CURRENT_RUNTIME === 'letta-desktop') {
              return {
                as: 'button' as const,
                onClick: () => {
                  handleMoveToAgent(agent.id);
                },
              };
            }

            return {
              as: 'a' as const,
              href: `${pathUntilAgents}/${agent.id}`,
              target: '_blank',
            };
          })();

          return (
            <HStack
              padding="small"
              fullWidth
              align="center"
              borderBottom={index !== agents.length - 1 ? true : undefined}
              key={agent.id}
              {...payload}
            >
              <LettaAgentTypeIcon type={agent.agent_type} />
              <VStack collapseWidth flex gap={false}>
                <Typography
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
                  overflow="ellipsis"
                  fullWidth
                  variant="body4"
                >
                  {agent.id}
                </Typography>
              </VStack>
              <AgentBadge isCurrentAgent={isCurrentAgent} />
            </HStack>
          );
        })}
      </VStack>
    </Popover>
  );
}
