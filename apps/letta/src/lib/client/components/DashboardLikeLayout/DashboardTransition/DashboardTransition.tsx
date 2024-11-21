'use client';

import { gsap } from 'gsap';
import { TransitionRouter } from 'next-transition-router';
import {
  HStack,
  LoadingEmptyStatusComponent,
  VStack,
} from '@letta-web/component-library';
import * as React from 'react';

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
      className={`z-[-1] top-0 w-full h-full ${
        isVisibile ? 'opacity-100' : 'opacity-0'
      } transition-opacity duration-150`}
    >
      <LoadingEmptyStatusComponent emptyMessage="" isLoading />
    </div>
  );
}

export function DashboardTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isTransitioning, setIsTransitioning] = React.useState(false);

  return (
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
          }
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
          }
        );

        return () => tl.kill();
      }}
    >
      <VStack
        /* eslint-disable-next-line react/forbid-component-props */
        className="encapsulated-full-height largerThanMobile:pl-0 pl-1 z-[-1]"
        paddingY="xxsmall"
        paddingRight="xxsmall"
        fullWidth
        fullHeight
        color="background"
        position="absolute"
      >
        <VStack fullWidth fullHeight border></VStack>
      </VStack>
      {isTransitioning && <TransitionLoader />}
      <HStack fullWidth id="main">
        {children}
      </HStack>
    </TransitionRouter>
  );
}
