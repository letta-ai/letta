'use client';

import { gsap } from 'gsap';
import { TransitionRouter } from 'next-transition-router';
import {
  Frame,
  HStack,
  LoadingEmptyStatusComponent,
  VStack,
} from '@letta-cloud/ui-component-library';
import * as React from 'react';
import './DashboardTransition.scss';
import { cn } from '@letta-cloud/ui-styles';

function TransitionLoader() {
  // only will appear if element has existed for more than 0.5s
  const [isVisibile, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, 500);

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div
      id="loader"
      className={`z-[-1] top-0 absolute w-full h-[90dvh] ${
        isVisibile ? 'opacity-100' : 'opacity-0'
      } transition-opacity duration-150`}
    >
      <LoadingEmptyStatusComponent emptyMessage="" isLoading />
    </div>
  );
}

export function DashboardTransition({
  children,
  alwaysFullscreenBox,
}: {
  alwaysFullscreenBox?: boolean;
  children: React.ReactNode;
}) {
  const [isTransitioning, setIsTransitioning] = React.useState(false);

  return (
    <Frame fullHeight fullWidth>
      <TransitionRouter
        auto={true}
        leave={(next) => {
          setIsTransitioning(true);
          const tl = gsap.timeline({
            onComplete: next,
          });

          tl.fromTo(
            document.getElementById('main'),
            { autoAlpha: 1 },
            {
              ease: 'power1.out',
              duration: 0.175,
              autoAlpha: 0,
            },
          );

          return () => {
            tl.kill();
          };
        }}
        enter={(next) => {
          const tl = gsap.timeline({
            onComplete: next,
          });

          setIsTransitioning(false);
          tl.fromTo(
            document.getElementById('main'),
            { autoAlpha: 0 },
            {
              ease: 'power1.in',
              duration: 0,
              autoAlpha: 1,
            },
          );

          return () => tl.kill();
        }}
      >
        <VStack
          /* eslint-disable-next-line react/forbid-component-props */
          className={cn(
            'transition-box z-[-1]',
            alwaysFullscreenBox ? 'always-fullscreen-transition-box' : '',
          )}
          paddingTop="xxsmall"
          paddingRight="xxsmall"
          color="background"
          position="fixed"
          gap={false}
        >
          {isTransitioning && <TransitionLoader />}
          <VStack fullWidth fullHeight border></VStack>
        </VStack>
        <div className="w-full bottom-0 z-[99] h-[4px] fixed bg-background"></div>
        <HStack fullWidth id="main">
          {children}
        </HStack>
      </TransitionRouter>
    </Frame>
  );
}
