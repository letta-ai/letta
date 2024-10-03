'use client';
import {
  Typography,
  MarketingButton,
  VStack,
  Logo,
} from '@letta-web/component-library';
import GoogleLogo from './google-logo.png';
import Image from 'next/image';
import type { ElementRef } from 'react';
import { Suspense } from 'react';
import { useMemo } from 'react';
import { useEffect, useCallback, useRef } from 'react';
import { isNull } from 'lodash-es';
import './Login.scss';
import { useSearchParams } from 'next/navigation';
import {
  isTextALoginError,
  LoginErrorsEnum,
  LoginErrorsMap,
} from '$letta/errors';

function LoginErrorBanner() {
  const searchParams = useSearchParams();

  const message = searchParams.get('errorCode');

  const errorMessage = useMemo(() => {
    if (isTextALoginError(message)) {
      return LoginErrorsMap[message];
    }
  }, [message]);

  if (!errorMessage) {
    return null;
  }

  if (message === LoginErrorsEnum.USER_NOT_IN_WHITELIST) {
    return (
      <div className="select-none	relative">
        <a href="https://forms.letta.com/early-access">
          <div className="absolute left-[-150px] top-[-50px] w-[300px] mb-[20px] whitespace-nowrap flex items-center bg-white text-black">
            <div>JOIN OUR WAITLIST JOIN OUR WAITLIST JOIN US</div>
          </div>
        </a>
        <a href="https://forms.letta.com/early-access">
          <div className="absolute rotate-90 top-[130px] left-[-6px] w-[336px] whitespace-nowrap flex items-center bg-white text-black">
            <div>JOIN OUR WAITLIST JOIN OUR WAITLIST JOIN US</div>
          </div>
        </a>
        <a href="https://forms.letta.com/early-access">
          <div className="absolute left-[-150px] top-[310px] rotate-180 w-[300px] mb-[20px] whitespace-nowrap flex items-center bg-white text-black">
            <div>JOIN OUR WAITLIST JOIN OUR WAITLIST JOIN US</div>
          </div>
        </a>
        <a href="https://forms.letta.com/early-access">
          <div className="absolute rotate-[270deg] top-[130px] right-[-6px] w-[336px] whitespace-nowrap flex items-center bg-white text-black">
            <div>JOIN OUR WAITLIST JOIN OUR WAITLIST JOIN US</div>
          </div>
        </a>
      </div>
    );
  }

  return (
    <div className="fade-in-0 absolute top-[-90px] slide-in-from-bottom-2 text-mono mt-4 bg-white text-black animate-in  p-1 px-4 rounded">
      {errorMessage}
    </div>
  );
}

export function LoginComponent() {
  const marketingButtonRef = useRef<ElementRef<typeof MarketingButton>>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  const spinOnClick = useCallback(() => {
    if (isNull(logoRef.current)) {
      return;
    }

    logoRef.current.style.animation = 'logo-spin 3s linear forwards';
    logoRef.current.style.transform = 'rotateX(0deg) rotateY(0deg)';
  }, []);

  useEffect(() => {
    if (isNull(marketingButtonRef.current)) {
      return;
    }

    marketingButtonRef.current.addEventListener('mousemove', (e) => {
      if (isNull(logoRef.current) || isNull(marketingButtonRef.current)) {
        return;
      }

      // given the range of the width and height of the button, we can calculate the angle of rotation
      // based on the position of the mouse
      // the degree of rotation for x is between 35 and 90
      // the degree of rotation for y is between 45 and -45

      const { left, width } =
        marketingButtonRef.current.getBoundingClientRect();

      const yAngle = ((e.clientX - left) / width) * 90 - 45;

      logoRef.current.style.transform = `rotateX(30deg) rotateY(${-yAngle}deg)`;
      logoRef.current.style.transformOrigin = 'center center';
      logoRef.current.style.transition = 'transform 250ms';
    });

    marketingButtonRef.current.addEventListener('mouseleave', () => {
      if (isNull(logoRef.current)) {
        return;
      }

      logoRef.current.style.transform = 'rotateX(0deg) rotateY(0deg)';
    });
  }, []);

  return (
    <VStack align="center" position="relative" fullWidth>
      <Suspense>
        <LoginErrorBanner />
      </Suspense>

      {/* eslint-disable-next-line react/forbid-component-props */}
      <VStack className="w-[300px] gap-[36px]" align="center">
        <VStack align="center" gap="large">
          <div className="relative" ref={logoRef}>
            <Logo size="large" />
          </div>
          <Typography bold variant="heading5">
            Sign in to Letta
          </Typography>
        </VStack>
        <MarketingButton
          onClick={spinOnClick}
          ref={marketingButtonRef}
          href="/auth/google/init"
          variant="secondary"
          preIcon={
            <div>
              <Image width={16} height={16} src={GoogleLogo} alt="" />
            </div>
          }
          label="Continue with Google"
        />
        <Typography>
          By clicking the button above, you agree to our{' '}
          <a className="underline" href="https://letta.com/terms-of-service">
            terms of service
          </a>{' '}
          and{' '}
          <a className="underline" href="https://letta.com/privacy-policy">
            privacy policy
          </a>
        </Typography>
      </VStack>
    </VStack>
  );
}
