import { CenterContent } from '../../../../../lib/client/components/CenterContent/CenterContent';
import { HStack, Typography, VStack } from '@letta-cloud/ui-component-library';
import { VoteHandlers } from './VoteHandlers/VoteHandlers';
import { DownloadCount } from './DownloadCount/DownloadCount';
import './AgentHeader.scss';

interface AgentHeaderProps {
  name: string;
  author: string;
  downloadCount: number;
  upvotes: number;
  downvotes: number;
}

export function AgentHeader(props: AgentHeaderProps) {
  const { name, author, downloadCount, upvotes, downvotes } = props;
  return (
    <div className="pt-[40px]">
      <div className="absolute pointer-events-none agentheader-background border-b-border h-[231px] w-[100dvw]  border-b z-[0] top-0 left-0" />
      <CenterContent>
        <HStack>
          <VStack>
            <Typography variant="heading3">{name}.af</Typography>
            <HStack gap="large" align="center">
              <Typography color="lighter">{author}</Typography>
              <DownloadCount downloadCount={downloadCount} />
              <VoteHandlers upvotes={upvotes} downvotes={downvotes} />
            </HStack>
          </VStack>
        </HStack>
      </CenterContent>
    </div>
  );
}
