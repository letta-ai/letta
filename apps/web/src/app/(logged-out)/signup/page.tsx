'use client';
import {
  VStack,
  Button,
  Form,
  FormProvider,
  useForm,
  Typography,
} from '@letta-cloud/ui-component-library';
import React, { useMemo, useState } from 'react';
import { useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from '@letta-cloud/translations';
import { OAuthButtons } from '../OAuthButtons/OAuthButtons';
import { webApi, webApiContracts } from '@letta-cloud/sdk-web';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { useErrorTranslationMessage } from '@letta-cloud/utils-client';
import { useEffect } from 'react';
import { LoggedOutWrapper } from '../_components/LoggedOutWrapper/LoggedOutWrapper';
import { passwordValidation, createPasswordSignupFormSchema } from '../libs';
import {
  EmailField,
  PasswordAndConfirmationFields,
} from '../_components/fields';
import { Mode } from '../constants';
import { spinOnClickForLogo, useIsEmailSignupEnabled } from '../libs';

function SignupPage() {
  const searchParams = useSearchParams();
  const logoRef = useRef<HTMLDivElement | null>(null);
  const extraFieldsRef = useRef<HTMLDivElement>(null);
  const [isEmailEntered, setIsEmailEntered] = useState<boolean>(false);
  const [passwordValue, setPasswordValue] = useState<string>('');

  const spinOnClick = useCallback(() => {
    spinOnClickForLogo(logoRef);
  }, []);

  const { mutate, error, isPending, isSuccess } =
    webApi.user.createAccountWithPassword.useMutation();

  const t = useTranslations('pages/password');

  const isPasswordValid = useMemo(() => {
    return Object.values(passwordValidation).every(Boolean);
  }, []);

  const PasswordSignupFormSchema = useMemo(() => {
    return createPasswordSignupFormSchema(t, isPasswordValid);
  }, [t, isPasswordValid]);

  const errorTranslation = useErrorTranslationMessage(error, {
    messageMap: {
      emailAlreadyTaken: t('errors.emailAlreadyTaken'),
      default: t('errors.default'),
    },
    contract: webApiContracts.user.createAccountWithPassword,
  });

  type EmailFormValues = z.infer<typeof PasswordSignupFormSchema>;
  const form = useForm<EmailFormValues>({
    resolver: zodResolver(PasswordSignupFormSchema),
    defaultValues: {
      email: '',
      name: '',
      password: '',
      confirmPassword: '',
    },
  });

  const handleSubmit = useCallback(
    (data: EmailFormValues) => {
      mutate(
        {
          body: {
            email: data.email,
            name: data.name,
            password: data.password,
          },
        },
        {
          onSuccess: () => {
            window.location.href = '/';
          },
        },
      );
    },
    [mutate],
  );

  useEffect(() => {
    if (errorTranslation?.message) {
      const errorMessageLocation = 'confirmPassword';
      form.setError(errorMessageLocation, {
        message: errorTranslation?.message,
      });
    }
  }, [errorTranslation?.message, form]);

  const enabled = useIsEmailSignupEnabled();
  return (
    <LoggedOutWrapper logoRef={logoRef}>
      <VStack align="center" position="relative" fullWidth>
        <VStack fullWidth gap="xlarge">
          {!enabled && (
            <VStack gap="small">
              <Typography variant="heading5" bold>
                {t('title')}
              </Typography>
              <Typography variant="body" color="muted">
                {t('description')}
              </Typography>
            </VStack>
          )}
          <OAuthButtons
            type={Mode.SIGNUP}
            spinOnClick={spinOnClick}
            searchParams={searchParams}
          />
          {enabled && (
            <VStack gap="medium">
              <FormProvider {...form}>
                <Form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (isEmailEntered) {
                      void form.handleSubmit(handleSubmit)(e);
                    } else {
                      setIsEmailEntered(true);
                      if (extraFieldsRef.current) {
                        extraFieldsRef.current.classList.add('show');
                      }
                    }
                  }}
                >
                  <EmailField />

                  <div
                    className="extra-fields"
                    id="extraFields"
                    ref={extraFieldsRef}
                  >
                    <PasswordAndConfirmationFields
                      passwordValue={passwordValue}
                      setPasswordValue={setPasswordValue}
                    />
                  </div>

                  <Button
                    label={isEmailEntered ? t('submit') : t('continue')}
                    busy={isPending || isSuccess}
                    align="center"
                    bold
                    size="large"
                  />
                </Form>
              </FormProvider>
            </VStack>
          )}
        </VStack>
      </VStack>
    </LoggedOutWrapper>
  );
}

export default SignupPage;
