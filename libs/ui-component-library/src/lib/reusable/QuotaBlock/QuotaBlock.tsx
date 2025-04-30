import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { Typography } from '../../core/Typography/Typography';
import { QuotaProgressBar } from '../../core/QuotaProgressBar/QuotaProgressBar';
import { HStack } from '../../framing/HStack/HStack';
import { useTranslations } from '@letta-cloud/translations';
import { useNumberFormatter } from '@letta-cloud/utils-client';

interface QuotaBlockProps {
  max: number | 'infinite';
  value: number;
  label: string;
  type?: 'progress';
  footer?: React.ReactNode;
}

function QuotaContentRender(props: QuotaBlockProps) {
  switch (props.type) {
    case 'progress':
      return <QuotaProgressBar {...props} />;
    default:
      return null;
  }
}

export function QuotaBlock(props: QuotaBlockProps) {
  const { max, value, footer, label, type = 'progress' } = props;
  const t = useTranslations('components/QuotaBlock');

  const { formatNumber } = useNumberFormatter();
  return (
    <VStack color="background-grey" padding>
      <Typography bold>{label}</Typography>
      <HStack align="center">
        <HStack border fullWidth padding="xxsmall">
          <QuotaContentRender {...props} type={type} />
        </HStack>
        <HStack
          className="min-w-[125px]"
          justify="end"
          align="center"
          paddingLeft="xlarge"
        >
          <Typography noWrap>
            {t.rich('usage', {
              value: () => (
                <Typography bold variant="heading3" noWrap overrideEl="span">
                  {formatNumber(value)}
                </Typography>
              ),
              max: () => (
                <Typography noWrap bold overrideEl="span">
                  {typeof max === 'number' ? formatNumber(max) : '∞'}
                </Typography>
              ),
            })}
          </Typography>
        </HStack>
      </HStack>
      {footer}
    </VStack>
  );
}
