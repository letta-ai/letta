import type { GetAgentfilePartialDetailsType } from '@letta-cloud/sdk-web';
import { HStack, Typography, VStack } from '@letta-cloud/ui-component-library';
import Avatar from './Avatar.svg';
import { DownloadCount } from '../DownloadCount/DownloadCount';
import React from 'react';
import Image from 'next/image';

interface AgentFileCardProps {
  agent: GetAgentfilePartialDetailsType;
  imageSrc?: string;
}

export function AgentFileCard(props: AgentFileCardProps) {
  const { agent, imageSrc } = props;
  const { agentId, author, downloadCount, description, name } = agent;

  return (
    <VStack gap={null}>
      <VStack
        color="background-grey3"
        as="a"
        href={`/agents/${agentId}`}
        padding="small"
        border
      >
        {imageSrc && (
          <Image
            src={imageSrc}
            alt={name}
            width="300"
            height="300"
            style={{ width: '100%', height: 'auto' }}
          />
        )}
        <HStack>
          <VStack gap={false}>
            <Typography fullWidth overflow="ellipsis" bold>
              {name}
            </Typography>
            <Typography color="lighter" light>
              {author}
            </Typography>
          </VStack>
        </HStack>
        <VStack paddingY="small">
          <div className="h-[32px]">
            <Typography
              /* eslint-disable-next-line react/forbid-component-props */
              className="line-clamp-2"
              color="lighter"
              light
            >
              {description}
            </Typography>
          </div>
        </VStack>
        <HStack>
          <DownloadCount count={downloadCount} />
        </HStack>
      </VStack>
    </VStack>
  );
}
