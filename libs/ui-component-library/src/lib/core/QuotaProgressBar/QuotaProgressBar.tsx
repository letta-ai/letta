import * as React from 'react';
import { useMemo } from 'react';
import { cn } from '@letta-cloud/ui-styles';
import './QuotaProgressBar.scss';

interface QuotaProgressBarProps {
  max: number | 'infinite';
  value: number;
  // When true, colors become more critical as value decreases (for remaining credits)
  inverseColors?: boolean;
}

export function QuotaProgressBar(props: QuotaProgressBarProps) {
  const { max, value, inverseColors = false } = props;
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
    // Infinite always shows success/green
    if (max === 'infinite') {
      return 'infinite-transition';
    }

    if (inverseColors) {
      // Remaining credits: more remaining => healthy (blue)
      // Less remaining => caution/yellow then warning/red
      if (progress <= 0.2) {
        return 'warning-transition';
      }
      if (progress <= 0.5) {
        return 'caution-transition';
      }
      // Even when progress === 1 (full remaining), keep healthy color
      return 'progress-transition';
    }

    // Default behavior (usage): more used => more critical
    if (isComplete) {
      return 'complete-transition';
    }
    if (progress >= 0.8) {
      return 'warning-transition';
    }
    if (progress >= 0.5) {
      return 'caution-transition';
    }
    return 'progress-transition';
  }, [isComplete, max, progress, inverseColors]);

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
