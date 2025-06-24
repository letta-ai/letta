import { z } from 'zod';
import { isNull } from 'lodash-es';
import type { RefObject } from 'react';
import type { useTranslations } from '@letta-cloud/translations';
import { useFeatureFlag } from '@letta-cloud/sdk-web';

export function useIsEmailSignupEnabled() {
  const { data } = useFeatureFlag('EMAIL_SIGNUP');

  return !!data;
}

export function passwordValidation(passwordValue: string) {
  return {
    minLength: passwordValue.length >= 8,
    hasLowercase: /[a-z]/.test(passwordValue),
    hasUppercase: /[A-Z]/.test(passwordValue),
    hasNumber: /\d/.test(passwordValue),
    hasSymbol: /[!@#$%^&*(),.?":{}|<>]/.test(passwordValue),
  };
}

export function createPasswordSignupFormSchema(
  t: ReturnType<typeof useTranslations>,
  isPasswordValid: boolean,
) {
  return z
    .object({
      name: z.string(),
      email: z.string().email(),
      password: z
        .string()
        .min(8, {
          message: t('errors.passwordMinLength'),
        })
        .refine(() => isPasswordValid, {
          message: 'Password must meet all requirements',
        }),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('errors.passwordMismatch'),
      path: ['confirmPassword'],
    });
}

export function spinOnClickForLogo(logoRef: RefObject<HTMLDivElement | null>) {
  if (isNull(logoRef.current)) {
    return;
  }

  logoRef.current.style.animation = 'logo-spin 3s linear forwards';
  logoRef.current.style.transform = 'rotateX(0deg) rotateY(0deg)';
}
