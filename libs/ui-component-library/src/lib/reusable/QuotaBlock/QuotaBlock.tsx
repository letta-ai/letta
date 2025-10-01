import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { Typography } from '../../core/Typography/Typography';
import { QuotaProgressBar } from '../../core/QuotaProgressBar/QuotaProgressBar';
import { HStack } from '../../framing/HStack/HStack';
import { useTranslations } from '@letta-cloud/translations';
import { useFormatters } from '@letta-cloud/utils-client';
import { InfoTooltip } from '../InfoTooltip/InfoTooltip';

interface QuotaBlockProps {
  max: number | 'infinite';
  value: number;
  label?: string;
  type?: 'progress';
  testId?: string;
  tooltip?: string;
  footer?: React.ReactNode;
  badge?: React.ReactNode;
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
  const {
    max,
    value,
    footer,
    label,
    testId,
    badge,
    tooltip,
    type = 'progress',
  } = props;
  const t = useTranslations('components/QuotaBlock');

  const { formatNumber } = useFormatters();
  return (
    <VStack color="background-grey" padding>
      {label && (
        <HStack gap="small" align="center">
          <Typography bold>{label}</Typography>
          {badge}
          {tooltip && <InfoTooltip text={tooltip} />}
        </HStack>
      )}
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
                <Typography
                  data-testid={`${testId}-value`}
                  bold
                  variant="heading3"
                  noWrap
                  overrideEl="span"
                >
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
