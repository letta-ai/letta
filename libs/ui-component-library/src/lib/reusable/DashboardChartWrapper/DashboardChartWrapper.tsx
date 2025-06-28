import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import { Skeleton } from '../../core/Skeleton/Skeleton';
import { cn } from '@letta-cloud/ui-styles';
import { Button } from '../../core/Button/Button';
import { useTranslations } from '@letta-cloud/translations';
import { ExploreIcon } from '../../icons';

interface DashboardChartWrapperProps {
  title: string;
  children: React.ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  analysisLink?: string;
  headerActions?: React.ReactNode;
}

export function DashboardChartWrapper(props: DashboardChartWrapperProps) {
  const { title, children, isEmpty, isLoading, analysisLink, headerActions } =
    props;
  const t = useTranslations('components/DashboardChartWrapper');

  return (
    <div className={cn('h-[300px] flex flex-col p-2  min-w-[250px] w-full')}>
      <HStack
        align="center"
        justify="spaceBetween"
        padding="medium"
        paddingLeft="large"
      >
        <Typography variant="body2" bold>
          {title}
        </Typography>
        <HStack>
          {headerActions}
          {analysisLink && (
            <Button
              label={t('explore')}
              hideLabel
              color="tertiary"
              href={analysisLink}
              size="xsmall"
              square
              preIcon={<ExploreIcon />}
            />
          )}
        </HStack>
      </HStack>
      <div className="px-3 pb-3 w-full h-full">
        {isLoading ? (
          <Skeleton className="w-full h-full" />
        ) : (
          <>
            {isEmpty ? (
              <div className="w-full h-full p-5 flex items-center justify-center bg-background-grey">
                <Typography variant="body2">{t('noData')}</Typography>
              </div>
            ) : (
              <div className="w-full h-full">{children}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
