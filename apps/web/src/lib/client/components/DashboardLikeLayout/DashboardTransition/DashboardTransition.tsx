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
import type { GoingToADEViewType } from '$web/client/components/GoingToADEView/GoingToADEView';
import { GoingToADEView } from '$web/client/components/GoingToADEView/GoingToADEView';

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
  const [goingToADE, setGoingToADE] = React.useState<
    GoingToADEViewType | undefined
  >(undefined);

  return (
    <Frame overflow="hidden" color="background" fullHeight fullWidth>
      <TransitionRouter
        auto={true}
        leave={(next, _from, to) => {
          if (to) {
            if (to.includes('/templates/')) {
              setGoingToADE('template');
            } else if (to.includes('/agents/')) {
              setGoingToADE('agent');
            }
          }
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
        {isTransitioning && goingToADE && <GoingToADEView mode={goingToADE} />}
        <VStack
          /* eslint-disable-next-line react/forbid-component-props */
          className={cn(
            'transition-box z-[-1]',

            alwaysFullscreenBox ? 'always-fullscreen-transition-box' : '',
          )}
          border
          paddingTop="xxsmall"
          paddingRight="small2"
          position="fixed"
          gap={false}
        >
          {isTransitioning && <TransitionLoader />}
        </VStack>
        <HStack fullHeight fullWidth  >
          {children}
        </HStack>
      </TransitionRouter>
    </Frame>
  );
}
