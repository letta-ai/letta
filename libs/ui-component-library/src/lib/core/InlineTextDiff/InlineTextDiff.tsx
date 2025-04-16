import * as React from 'react';
import { diffWords } from 'diff';

interface InlineTextDiffProps {
  text: string;
  comparedText?: string;
}

export function InlineTextDiff(props: InlineTextDiffProps) {
  const { text, comparedText } = props;

  if (!comparedText) {
    return text;
  }

  const diff = diffWords(text, comparedText);

  return diff.map((part, index) => {
    const className = part.removed
      ? 'bg-destructive-diff line-through text-destructive-diff-content'
      : part.added
        ? 'bg-background-success text-background-success-content'
        : '';

    return (
      <span key={index} className={className}>
        {part.value}
      </span>
    );
  }, []);
}
