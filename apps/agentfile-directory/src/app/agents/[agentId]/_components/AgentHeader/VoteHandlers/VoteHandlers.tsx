'use client';

import { HStack, VoteComponent } from '@letta-cloud/ui-component-library';

interface VoteHandlersProps {
  upvotes: number;
  downvotes: number;
}

export function VoteHandlers(props: VoteHandlersProps) {
  const { upvotes, downvotes } = props;
  return (
    <HStack gap="small">
      <VoteComponent
        onVote={() => {
          return;
        }}
        isVoted={false}
        voteCount={upvotes}
        voteType="up"
      />

      <VoteComponent
        onVote={() => {
          return;
        }}
        isVoted={false}
        voteCount={downvotes}
        voteType="down"
      />
    </HStack>
  );
}
