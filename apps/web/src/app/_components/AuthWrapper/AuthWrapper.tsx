import { HStack, LettaLoader, VStack } from '@letta-cloud/ui-component-library';
import React from 'react';
import type { Ref } from 'react';
import './AuthWrapper.scss';

interface AuthWrapperProps {
  children: React.ReactNode;
  showLogo?: boolean;
  logoRef?: Ref<HTMLDivElement> | null;
  cardWidth?: number;
  containerClassName?: string;
  backgroundClassName?: string;
  headerContent?: React.ReactNode;
  footer?: React.ReactNode;
  bottomCard?: React.ReactNode;
}

export function AuthWrapper(props: AuthWrapperProps) {
  const {
    children,
    logoRef,
    showLogo = true,
    cardWidth = 400,
    containerClassName = 'auth-container',
    backgroundClassName = 'auth-background',
    headerContent,
    footer,
    bottomCard,
  } = props;

  return (
    <HStack
      overflow="auto"
      gap={false}
      // eslint-disable-next-line react/forbid-component-props
      className={`${containerClassName} max-h-[100dvh] box-content`}
    >
      <VStack
        zIndex="rightAboveZero"
        align="center"
        justify="center"
        fullHeight
        fullWidth
        color="background"
        // eslint-disable-next-line react/forbid-component-props
        className={backgroundClassName}
        gap={null}
      >
        <VStack
          // eslint-disable-next-line react/forbid-component-props
          className={`w-full border card`}
          // eslint-disable-next-line react/forbid-component-props
          style={{
            maxWidth: `${cardWidth}px`,
            maxHeight: '100%',
          }}
          align="center"
          gap="large"
          justify="center"
          padding="xxlarge"
          color="background-grey"
        >
          {showLogo && (
            <VStack paddingBottom="small" gap="xlarge" align="center" fullWidth>
              <HStack justify="spaceBetween" align="center" fullWidth>
                {showLogo && (
                  <div
                    className="relative  lottie-non-interactive w-[36px] h-[36px] min-h-[36px] min-w-[36px]"
                    ref={logoRef}
                  >
                    <LettaLoader variant="spinner3d" size="big" />
                  </div>
                )}
                {headerContent}
              </HStack>
            </VStack>
          )}
          {children}
          {footer}
        </VStack>
        {bottomCard}
      </VStack>
    </HStack>
  );
}
