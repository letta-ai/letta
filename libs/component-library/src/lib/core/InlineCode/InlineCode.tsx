import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CopyButton } from '../../reusable/CopyButton/CopyButton';

interface InlineCodeProps {
  code: string;
}

export function InlineCode({ code }: InlineCodeProps) {
  const t = useTranslations('ComponentLibrary/InlineCode');

  return (
    <span className="inline-flex bg-background-greyer py-0 pl-2  text-sm items-center rounded font-mono">
      {code}
      <CopyButton
        color="tertiary-transparent"
        hideLabel
        size="small"
        copyButtonText={t('copyButton')}
        textToCopy={code}
      />
    </span>
  );
}
