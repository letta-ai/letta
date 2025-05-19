'use client';

import React, { useMemo } from 'react';
import {
  Alert,
  FadeInImage,
  HStack,
  LettaLoader,
  Link,
  Skeleton,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { ThemeSelector } from '$web/client/components/ThemeSelector/ThemeSelector';
import { LocaleSelector } from '$web/client/components/LocaleSelector/LocaleSelector';
import WelcomeImage from './welcome-image.webp';
import { cn } from '@letta-cloud/ui-styles';
import '../WelcomeOverlayWrapper/WelcomeOverlay.scss';
import { useCurrentUser } from '$web/client/hooks';
import { webApi, webApiQueryKeys } from '$web/client';
import { VerifyComponent } from '$web/server/components/LoggedInLayout/VerifyAccountLoginWrapper/VerifyComponent/VerifyComponent';

interface VerifyAccountLoginWrapperProps {
  children: React.ReactNode;
}

export function VerifyAccountLoginWrapper(
  props: VerifyAccountLoginWrapperProps,
) {
  const { children } = props;
  const user = useCurrentUser();
  const t = useTranslations('VerifyAccountLoginWrapper');

  const { data: verifiedData } = webApi.user.getUserVerifiedContacts.useQuery({
    queryKey: webApiQueryKeys.user.getUserVerifiedContacts,
    refetchInterval: 2500,
    refetchOnWindowFocus: true,
    enabled: !user?.isVerified,
  });

  const verifiedPhoneNumber = useMemo(() => {
    if (verifiedData) {
      return verifiedData.body.phone;
    }
    return null;
  }, [verifiedData]);

  const verifiedEmail = useMemo(() => {
    if (verifiedData) {
      return verifiedData.body.email;
    }
    return null;
  }, [verifiedData]);

  if (!user || user.isVerified) {
    return children;
  }

  return (
    <VStack
      fullWidth
      fullHeight
      /* eslint-disable-next-line react/forbid-component-props */
      className={cn('h-[100dvh] welcome-overlay-wrapper')}
      color="background"
    >
      <HStack
        border
        fullWidth
        /* eslint-disable-next-line react/forbid-component-props */
        className="inner-container"
        padding="xlarge"
        color="background"
      >
        <div className="overflow-x-hidden relative flex inner-container-flexer">
          <div className="h-auto image-placeholder bg-transparent"></div>

          <VStack
            fullHeight
            paddingLeft="xlarge"
            /* eslint-disable-next-line react/forbid-component-props */
            className="main-content z-[1] right-0 relative"
            fullWidth
            color="background"
            paddingY
          >
            <HStack align="start" justify="spaceBetween">
              <Typography align="left" variant="heading1">
                {t('title')}
              </Typography>
              <HStack>
                <LocaleSelector />
                <ThemeSelector />
              </HStack>
            </HStack>
            <Typography align="left" variant="body">
              {t('subtitle')}
            </Typography>
            <VStack paddingTop>
              {!verifiedData ? (
                <VStack>
                  <Skeleton
                    /* eslint-disable-next-line react/forbid-component-props */
                    style={{ height: 85 }}
                  />
                  <Skeleton
                    /* eslint-disable-next-line react/forbid-component-props */
                    style={{ height: 85 }}
                  />
                </VStack>
              ) : (
                <VStack>
                  <VerifyComponent isVerified={!!verifiedEmail} type="email" />

                  <VerifyComponent
                    isVerified={!!verifiedPhoneNumber}
                    type="phone"
                  />
                </VStack>
              )}
            </VStack>
            <Alert
              title={t.rich('info', {
                link: (chunks) => <Link href="/signout">{chunks}</Link>,
              })}
              variant="info"
            />
          </VStack>
          <div className="image-render-container absolute z-[-1px] flex items-end bg-[#0707ab] w-full h-full">
            <div className="loader opacity-0 w-full flex h-full items-center absolute justify-center">
              <LettaLoader variant="flipper" color="steel" size="large" />
            </div>
            <FadeInImage src={WelcomeImage} alt="" />
          </div>
        </div>
      </HStack>
    </VStack>
  );
}
