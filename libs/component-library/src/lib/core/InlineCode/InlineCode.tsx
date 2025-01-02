import * as React from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { CopyButton } from '../../reusable/CopyButton/CopyButton';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { cn } from '@letta-web/core-style-config';

const inlineCodeVariants = cva(
  'inline-flex  text-sm gap-4 items-center border font-mono',
  {
    variants: {
      size: {
        small: 'text-sm px-1',
        medium: 'text-sm py-2 px-4',
      },
      color: {
        default: 'border',
        warning: 'border-warning-content',
        destructive: 'border-destructive',
      },
    },
    defaultVariants: {
      size: 'small',
    },
  },
);

export interface InlineCodeProps
  extends VariantProps<typeof inlineCodeVariants> {
  code: string;
  hideCopyButton?: boolean;
}

export function InlineCode({ code, hideCopyButton, ...rest }: InlineCodeProps) {
  const t = useTranslations('ComponentLibrary/InlineCode');

  return (
    <span
      className={cn(
        inlineCodeVariants({
          ...rest,
        }),
        'border',
      )}
    >
      {code}
      {!hideCopyButton && (
        <CopyButton
          color="tertiary-transparent"
          hideLabel
          size="small"
          copyButtonText={t('copyButton')}
          textToCopy={code}
        />
      )}
    </span>
  );
}
