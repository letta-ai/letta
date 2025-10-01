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
import { getCharCount, getLineDiff, getChangedLine } from './utils';
import { MemoryCardInfoChips } from './MemoryCardInfoChips';
import './CoreMemoryCard.scss';

const STATE_UPDATED_TIMEOUT = 5000;

export interface CoreMemoryCardProps {
  label: string | null | undefined;
  value?: string;
  infoToolTipContent?: string;
  lastUpdatedAt?: string;
  sharedAgents?: SharedAgent[];
  readOnly?: boolean | null | undefined;
  preserveOnMigration?: boolean | null | undefined;
  openInAdvanced?: VoidFunction;
  isSelected?: boolean;
}

interface MemoryDiffProps {
  value: string;
}

interface MemoryDiffResult {
  oldLine: string | null;
  newLine: string | null;
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
  backgroundClassName?: string;
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

  return getChangedLine(initialState.current, value);
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
  backgroundClassName,
}: CoreMemoryCardInfoBarProps) {
  const { formatRelativeDate } = useFormatters();
  const t = useTranslations('components/CoreMemoryCard');

  return (
    <HStack
      className={
        diffCount
          ? cn(
              `bg-background-grey z-20 group-hover:bg-brand-light`,
              backgroundClassName,
            )
          : undefined
      }
      paddingBottom="xxsmall"
    >
      {numChar > 0 && (
        <Typography color="muted" variant="body3">
          {t('chars', { numChar })}
        </Typography>
      )}
      {lastUpdatedAt && (
        <Typography color="muted" variant="body3">
          {t('updated', {
            relativeDate: formatRelativeDate(lastUpdatedAt),
          })}
        </Typography>
      )}
      {diffCount && (
        <>
          <Typography color="muted" variant="body3">
            -{diffCount.minusLines}
          </Typography>
          <Typography color="muted" variant="body3">
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
  isSelected,
}: UpdatedCoreMemoryCardProps) {
  const diffCount = getLineDiff(value, diffValue);

  const cardColor = isSelected ? 'primary-light' : 'background-grey';
  const backgroundClassName = cn(
    isSelected ? 'bg-primary-light' : 'bg-background-grey',
    'group-hover:bg-brand-light z-20',
  );

  return (
    <Card
      className={cn(
        'group h-[110px] cursor-pointer border-b-2 hover:bg-brand-light overflow-hidden',
      )}
      onClick={openInAdvanced}
      color={cardColor}
    >
      <VStack gap={false}>
        <div className={backgroundClassName}>
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

        <div className={cn('h-[61px] relative')}>
          <HStack className={backgroundClassName} paddingBottom="xxsmall">
            <div
              className={cn(
                'w-1.5 h-1.5 bg-background-blue2 rounded-full relative top-1.5',
              )}
            />
            <CoreMemoryCardInfoBar
              numChar={numChar}
              lastUpdatedAt={lastUpdatedAt}
              diffCount={diffCount}
              backgroundClassName={isSelected ? 'bg-brand-light' : ''}
            />
          </HStack>

          <VStack className={cn('overflow-hidden')}>
            <div className={cn('slide-up-animation-diff-values z-10')}>
              {value ? (
                <>
                  <div className={cn('h-[39px]')} />
                  <Typography variant="body3" className={cn('truncate')}>
                    - {value}
                  </Typography>
                </>
              ) : (
                <div className={cn('h-[41px]')}></div>
              )}
              {diffValue && (
                <Typography
                  color="positive"
                  variant="body3"
                  className={cn('truncate')}
                >
                  + {diffValue}
                </Typography>
              )}
            </div>
          </VStack>
        </div>
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
  isSelected,
}: RegularCoreMemoryCardProps) {
  const t = useTranslations('components/CoreMemoryCard');

  const cardColor = isSelected ? 'primary-light' : 'background-grey';

  return (
    <Card
      className={cn(
        'group h-[110px] cursor-pointer border-b-2 hover:bg-brand-light',
      )}
      onClick={openInAdvanced}
      color={cardColor}
    >
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

        <div className={cn('h-[61px]')}>
          <CoreMemoryCardInfoBar
            numChar={numChar}
            lastUpdatedAt={lastUpdatedAt}
          />

          <VStack className={cn('h-[39px]')}>
            {value ? (
              <Typography variant="body3" className={cn('line-clamp-2')}>
                {value}
              </Typography>
            ) : (
              <Typography
                variant="body3"
                color="muted"
                className={cn('line-clamp-2')}
              >
                {t('emptyValueText')}
              </Typography>
            )}
          </VStack>
        </div>
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
    isSelected,
  } = props;

  const { oldLine, newLine } = MemoryDiff({
    value: value || '',
  });

  const justUpdated = useMemo(() => {
    return oldLine !== null || newLine !== null;
  }, [oldLine, newLine]);

  const calculatedNumChar = getCharCount(value);

  if (justUpdated) {
    return (
      <UpdatedCoreMemoryCard
        label={label}
        value={oldLine || undefined}
        infoToolTipContent={infoToolTipContent}
        diffValue={newLine || undefined}
        numChar={calculatedNumChar}
        lastUpdatedAt={lastUpdatedAt}
        sharedAgents={sharedAgents}
        readOnly={readOnly}
        preserveOnMigration={preserveOnMigration}
        openInAdvanced={openInAdvanced}
        isSelected={isSelected}
      />
    );
  }

  return (
    <RegularCoreMemoryCard
      label={label}
      value={value}
      infoToolTipContent={infoToolTipContent}
      numChar={calculatedNumChar}
      lastUpdatedAt={lastUpdatedAt}
      sharedAgents={sharedAgents}
      readOnly={readOnly}
      preserveOnMigration={preserveOnMigration}
      openInAdvanced={openInAdvanced}
      isSelected={isSelected}
    />
  );
}
