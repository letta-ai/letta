import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CopyButton } from '../../reusable/CopyButton/CopyButton';

interface InlineCodeProps {
  code: string;
  hideCopyButton?: boolean;
}

export function InlineCode({ code, hideCopyButton }: InlineCodeProps) {
  const t = useTranslations('ComponentLibrary/InlineCode');

  return (
    <span className="inline-flex py-2 px-4 text-sm gap-4 items-center border font-mono">
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
