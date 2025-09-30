'use client';

import { useMemo, useRef, useEffect } from 'react';
import {
  InfoTooltip,
  Typography,
  VStack,
  HStack,
  Card,
  type SharedAgent,
} from '@letta-cloud/ui-component-library';
import { cn } from '@letta-cloud/ui-styles';
import { useFormatters } from '@letta-cloud/utils-client';
import { useTranslations } from '@letta-cloud/translations';
import { getCharCount, getLineDiff } from './utils';
import { MemoryCardInfoChips } from './MemoryCardInfoChips';
import './CoreMemoryCard.scss';

const STATE_UPDATED_TIMEOUT = 5000;

export interface CoreMemoryCardProps {
  label: string;
  value?: string;
  infoToolTipContent?: string;
  lastUpdatedAt?: string;
  sharedAgents?: SharedAgent[];
  readOnly?: boolean;
  preserveOnMigration?: boolean;
  openInAdvanced?: VoidFunction;
}

interface MemoryDiffProps {
  value: string;
}

interface MemoryDiffResult {
  initialState: string;
  currentValue: string;
}

interface LineDiffCount {
  minusLines: number;
  plusLines: number;
}

interface CoreMemoryCardHeaderProps extends CoreMemoryCardProps {
  isUpdated?: boolean;
}

interface WithNumChar {
  numChar: number;
}

interface CoreMemoryCardInfoBarProps extends WithNumChar {
  lastUpdatedAt?: string;
  diffCount?: LineDiffCount;
}

interface UpdatedCoreMemoryCardProps extends CoreMemoryCardProps, WithNumChar {
  diffValue?: string;
}

interface RegularCoreMemoryCardProps extends CoreMemoryCardProps, WithNumChar {}

function MemoryDiff(props: MemoryDiffProps): MemoryDiffResult {
  const { value } = props;
  const initialState = useRef<string>(value);

  useEffect(() => {
    const state = setTimeout(() => {
      initialState.current = value;
    }, STATE_UPDATED_TIMEOUT);

    return () => {
      clearTimeout(state);
    };
  }, [value]);

  return { initialState: initialState.current, currentValue: value };
}

function CoreMemoryCardHeader({
  label,
  infoToolTipContent,
  sharedAgents,
  readOnly,
  preserveOnMigration,
  openInAdvanced,
  isUpdated = false,
}: CoreMemoryCardHeaderProps) {
  return (
    <HStack justify="spaceBetween">
      <HStack>
        <Typography variant="heading6" bold={isUpdated}>
          {label}
        </Typography>
        {infoToolTipContent && <InfoTooltip text={infoToolTipContent} />}
      </HStack>
      <MemoryCardInfoChips
        sharedAgents={sharedAgents}
        readOnly={readOnly}
        preserveOnMigration={preserveOnMigration}
        openInAdvanced={openInAdvanced}
      />
    </HStack>
  );
}

function CoreMemoryCardInfoBar({
  numChar,
  lastUpdatedAt,
  diffCount,
}: CoreMemoryCardInfoBarProps) {
  const { formatRelativeDate } = useFormatters();
  const t = useTranslations('components/CoreMemoryCard');

  return (
    <HStack
      className={diffCount ? cn('bg-background-grey z-20') : undefined}
      paddingBottom="xxsmall"
    >
      {numChar > 0 && (
        <Typography color="muted" variant="body2">
          {t('chars', { numChar })}
        </Typography>
      )}
      {lastUpdatedAt && (
        <Typography color="muted" variant="body2">
          {t('updated', {
            relativeDate: formatRelativeDate(lastUpdatedAt),
          })}
        </Typography>
      )}
      {diffCount && (
        <>
          <Typography color="muted" variant="body2">
            -{diffCount.minusLines}
          </Typography>
          <Typography color="muted" variant="body2">
            +{diffCount.plusLines}
          </Typography>
        </>
      )}
    </HStack>
  );
}

function UpdatedCoreMemoryCard({
  label,
  value,
  infoToolTipContent,
  diffValue,
  numChar,
  lastUpdatedAt,
  sharedAgents,
  readOnly,
  preserveOnMigration,
  openInAdvanced,
}: UpdatedCoreMemoryCardProps) {
  const diffCount = getLineDiff(value, diffValue);

  return (
    <Card className={cn('bg-background-grey h-[115px] overflow-hidden')}>
      <VStack gap={false}>
        <div className={cn('bg-background-grey z-20')}>
          <CoreMemoryCardHeader
            label={label}
            infoToolTipContent={infoToolTipContent}
            sharedAgents={sharedAgents}
            readOnly={readOnly}
            preserveOnMigration={preserveOnMigration}
            openInAdvanced={openInAdvanced}
            isUpdated={true}
          />
        </div>

        <HStack
          className={cn('bg-background-grey z-20')}
          paddingBottom="xxsmall"
        >
          <div
            className={cn(
              'w-1.5 h-1.5 bg-background-blue2 rounded-full relative top-1.5',
            )}
          />
          <CoreMemoryCardInfoBar
            numChar={numChar}
            lastUpdatedAt={lastUpdatedAt}
            diffCount={diffCount}
          />
        </HStack>

        <VStack className={cn('overflow-hidden')}>
          <div className={cn('slide-up-animation-diff-values z-10')}>
            {value ? (
              <>
                <VStack className={cn('h-[39px]')}>
                  <Typography variant="body2" className={cn('line-clamp-2')}>
                    {value}
                  </Typography>
                </VStack>
                <Typography variant="body2" className={cn('truncate')}>
                  - {value}
                </Typography>
              </>
            ) : (
              <div className={cn('h-[41px]')}></div>
            )}
            {diffValue && (
              <Typography
                color="positive"
                variant="body2"
                className={cn('truncate')}
              >
                + {diffValue}
              </Typography>
            )}
          </div>
        </VStack>
      </VStack>
    </Card>
  );
}

function RegularCoreMemoryCard({
  label,
  value,
  infoToolTipContent,
  numChar,
  lastUpdatedAt,
  sharedAgents,
  readOnly,
  preserveOnMigration,
  openInAdvanced,
}: RegularCoreMemoryCardProps) {
  return (
    <Card className={cn('bg-background-grey h-[115px]')}>
      <VStack gap={false}>
        <CoreMemoryCardHeader
          label={label}
          infoToolTipContent={infoToolTipContent}
          sharedAgents={sharedAgents}
          readOnly={readOnly}
          preserveOnMigration={preserveOnMigration}
          openInAdvanced={openInAdvanced}
          isUpdated={false}
        />

        <CoreMemoryCardInfoBar
          numChar={numChar}
          lastUpdatedAt={lastUpdatedAt}
        />

        {value && (
          <VStack className={cn('h-[39px]')}>
            <Typography variant="body2" className={cn('line-clamp-2')}>
              {value}
            </Typography>
          </VStack>
        )}
      </VStack>
    </Card>
  );
}

export function CoreMemoryCard(props: CoreMemoryCardProps) {
  const {
    label,
    value,
    infoToolTipContent,
    lastUpdatedAt,
    sharedAgents,
    readOnly,
    preserveOnMigration,
    openInAdvanced,
  } = props;

  const { initialState, currentValue } = MemoryDiff({
    value: value || '',
  });

  const justUpdated = useMemo(() => {
    return initialState !== currentValue;
  }, [initialState, currentValue]);

  const calculatedNumChar = getCharCount(currentValue);

  if (justUpdated) {
    return (
      <UpdatedCoreMemoryCard
        label={label}
        value={initialState}
        infoToolTipContent={infoToolTipContent}
        diffValue={justUpdated ? currentValue : undefined}
        numChar={calculatedNumChar}
        lastUpdatedAt={lastUpdatedAt}
        sharedAgents={sharedAgents}
        readOnly={readOnly}
        preserveOnMigration={preserveOnMigration}
        openInAdvanced={openInAdvanced}
      />
    );
  }

  return (
    <RegularCoreMemoryCard
      label={label}
      value={currentValue}
      infoToolTipContent={infoToolTipContent}
      numChar={calculatedNumChar}
      lastUpdatedAt={lastUpdatedAt}
      sharedAgents={sharedAgents}
      readOnly={readOnly}
      preserveOnMigration={preserveOnMigration}
      openInAdvanced={openInAdvanced}
    />
  );
}
