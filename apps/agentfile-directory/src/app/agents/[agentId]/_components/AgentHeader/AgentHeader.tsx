import { CenterContent } from '../../../../../lib/client/components/CenterContent/CenterContent';
import { HStack, Typography, VStack } from '@letta-cloud/ui-component-library';
import { DownloadCount } from './DownloadCount/DownloadCount';
import './AgentHeader.scss';
import { AgentHeaderActions } from './AgentHeaderActions/AgentHeaderActions';

interface AgentHeaderProps {
  name: string;
  author: string;
  downloadCount: number;
  upvotes: number;
  downvotes: number;
  agentId: string;
}

export function AgentHeader(props: AgentHeaderProps) {
  const { name, agentId, author, downloadCount } = props;
  return (
    <div className="pt-[40px]">
      <CenterContent>
        <div className="z-[1] relative">
          <HStack justify="spaceBetween">
            <VStack>
              <Typography variant="heading3">{name}</Typography>
              <HStack gap="large" align="center">
                <Typography color="lighter">{author}</Typography>
                <DownloadCount downloadCount={downloadCount} />
                {/*<VoteHandlers upvotes={upvotes} downvotes={downvotes} />*/}
              </HStack>
            </VStack>
            <AgentHeaderActions agentId={agentId} agentName={name} />
          </HStack>
        </div>
      </CenterContent>
      <div className="absolute pointer-events-none agentheader-background border-b-border h-[238px] w-[100dvw]  border-b z-[0] top-0 left-0" />
    </div>
  );
}
