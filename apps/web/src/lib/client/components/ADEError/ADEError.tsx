import {
  ArrowLeftIcon,
  Button,
  HStack,
  LoadingEmptyStatusComponent,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { ProfilePopover } from '$web/client/components/DashboardLikeLayout/DashboardNavigation/DashboardNavigation';

interface ADEErrorProps {
  errorCode: 'agentNotFound' | 'templateNotFound';
}

export function ADEError(props: ADEErrorProps) {
  const { errorCode } = props;

  const t = useTranslations('components/ADEError');

  const translation = useMemo(() => {
    return {
      agentNotFound: t('agentNotFound'),
      templateNotFound: t('templateNotFound'),
    }[errorCode];
  }, [errorCode, t]);

  return (
    <VStack
      overflow="hidden"
      color="background"
      /* eslint-disable-next-line react/forbid-component-props */
      className="w-[100vw]  h-[100dvh]"
      fullHeight
      fullWidth
      gap
    >
      <HStack
        align="center"
        padding="small"
        borderBottom
        justify="spaceBetween"
        fullWidth
      >
        <Button
          href="/projects"
          preIcon={<ArrowLeftIcon />}
          size="small"
          label={t('goBack')}
          color="tertiary"
        />
        <ProfilePopover />
      </HStack>
      <VStack fullHeight>
        <LoadingEmptyStatusComponent
          emptyMessage=""
          isError
          errorMessage={translation}
        />
      </VStack>
    </VStack>
  );
}
