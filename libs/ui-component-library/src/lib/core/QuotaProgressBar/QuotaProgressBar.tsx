import * as React from 'react';
import { useMemo } from 'react';
import { cn } from '@letta-cloud/ui-styles';
import './QuotaProgressBar.scss';

interface QuotaProgressBarProps {
  max: number | 'infinite';
  value: number;
}

export function QuotaProgressBar(props: QuotaProgressBarProps) {
  const { max, value } = props;
  const progress = useMemo(() => {
    if (max === 'infinite') {
      return 1;
    }
    return Math.min(value / max, 1);
  }, [max, value]);

  const isComplete = useMemo(() => {
    return progress >= 1;
  }, [progress]);

  const inverseProgress = useMemo(() => {
    return 1 - progress;
  }, [progress]);

  const transitionColor = useMemo(() => {
    if (isComplete) {
      if (max === 'infinite') {
        return 'infinite-transition';
      }

      return 'complete-transition';
    }

    return 'progress-transition';
  }, [isComplete, max]);

  return (
    <div
      className={cn(
        'h-[28px] w-full bg-background flex justify-end relative',
        transitionColor,
      )}
    >
      <div className="mr-[33%] h-full w-[1px] bg-background absolute" />
      <div className="mr-[66%] h-full w-[1px] bg-background absolute" />

      <div
        className="bg-background  h-full"
        style={{ width: `${inverseProgress * 100}%` }}
      />
    </div>
  );
}
