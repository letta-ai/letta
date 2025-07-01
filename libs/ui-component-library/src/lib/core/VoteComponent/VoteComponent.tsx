'use client';
import * as React from 'react';
import {
  ThumbsUpIcon,
  ThumbsUpFilledIcon,
  ThumbsDownFilledIcon,
  ThumbsDownIcon,
} from '../../icons';
import { cn } from '@letta-cloud/ui-styles';
import { useMemo } from 'react';
import { useFormatters } from '@letta-cloud/utils-client';
import './VoteComponent.scss';

type VoteType = 'down' | 'up';

interface VoteComponentProps<TVoteType extends VoteType> {
  onVote: (voteType: TVoteType) => void;
  voteCount: number;
  isVoted: boolean;
  voteType: TVoteType;
}

interface VoteIconProps {
  voteType: VoteType;
  isVoted: boolean;
}

function VoteIcon(props: VoteIconProps) {
  const { voteType, isVoted } = props;

  if (voteType === 'up') {
    if (isVoted) {
      return <ThumbsUpFilledIcon size="auto" className="w-[14px] h-[14px]" />;
    }

    return <ThumbsUpIcon size="auto" className="w-[14px] h-[14px]" />;
  }

  if (voteType === 'down') {
    if (isVoted) {
      return <ThumbsDownFilledIcon size="auto" className="w-[14px] h-[14px]" />;
    }

    return <ThumbsDownIcon size="auto" className="w-[14px] h-[14px] " />;
  }
}

export function VoteComponent<TVoteType extends VoteType>(
  props: VoteComponentProps<TVoteType>,
) {
  const { onVote, isVoted, voteCount, voteType } = props;

  const { formatShorthandNumber } = useFormatters();

  const isVoteUp = useMemo(() => voteType === 'up', [voteType]);

  return (
    <button
      onClick={() => {
        onVote(voteType);
      }}
      className="w-[54px] h-[24px]  items-center flex"
    >
      <div
        className={cn(
          isVoteUp ? 'upvote-container' : 'downvote-container',
          'flex items-center min-w-[24px] h-[24px] justify-center gap-2',
        )}
      >
        <VoteIcon voteType={voteType} isVoted={isVoted} />
      </div>
      <span className="text-sm border-t border-r border-b align-center w-full h-full justify-center flex items-center font-semibold text-content">
        {formatShorthandNumber(voteCount)}
      </span>
    </button>
  );
}
