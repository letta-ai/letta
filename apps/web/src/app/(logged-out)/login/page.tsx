'use client';
import {
  VStack,
  Button,
  Form,
  FormProvider,
  useForm,
  Alert,
} from '@letta-cloud/ui-component-library';
import { useState } from 'react';
import { useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from '@letta-cloud/translations';
import { OAuthButtons } from '../OAuthButtons/OAuthButtons';
import { webApi, webApiContracts } from '@letta-cloud/sdk-web';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useErrorTranslationMessage } from '@letta-cloud/utils-client';
import { useEffect } from 'react';
import { LoggedOutWrapper } from '../_components/LoggedOutWrapper/LoggedOutWrapper';
import { Mode } from '../constants';
import { EmailField, PasswordField } from '../_components/fields';
import { spinOnClickForLogo } from '../libs';
import { LoginErrorsMap, isTextALoginError } from '$web/errors';

const PasswordLoginSchema = z.object({
  email: z.string(),
  password: z.string(),
});

type PasswordLoginSchemaType = z.infer<typeof PasswordLoginSchema>;

function LoginPage() {
  const searchParams = useSearchParams();
  const logoRef = useRef<HTMLDivElement>(null);
  const extraFieldsRef = useRef<HTMLDivElement>(null);
  const [isEmailEntered, setIsEmailEntered] = useState<boolean>(false);

  // Handle URL error codes
  const errorCode = searchParams.get('errorCode');
  const urlErrorMessage =
    errorCode && isTextALoginError(errorCode)
      ? LoginErrorsMap[errorCode]
      : null;

  const spinOnClick = useCallback(() => {
    spinOnClickForLogo(logoRef);
  }, []);

  const t = useTranslations('password-login');

  const { mutate, error, isPending, isSuccess } =
    webApi.user.loginWithPassword.useMutation();

  const form = useForm<PasswordLoginSchemaType>({
    resolver: zodResolver(PasswordLoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const errorTranslation = useErrorTranslationMessage(error, {
    messageMap: {
      invalidPassword: t('errors.invalidPassword'),
      default: t('errors.default'),
    },
    contract: webApiContracts.user.loginWithPassword,
  });

  const handleSubmit = useCallback(
    (values: PasswordLoginSchemaType) => {
      mutate(
        {
          body: {
            email: values.email,
            password: values.password,
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
      const errorMessageLocation = 'password';
      form.setError(errorMessageLocation, {
        message: errorTranslation?.message,
      });
    }
  }, [errorTranslation?.message, form]);

  return (
    <LoggedOutWrapper logoRef={logoRef}>
      <VStack align="center" position="relative" fullWidth>
        <VStack fullWidth gap="xlarge">
          {urlErrorMessage && (
            <Alert title={urlErrorMessage} variant="destructive" />
          )}
          <OAuthButtons
            type={Mode.LOGIN}
            spinOnClick={spinOnClick}
            searchParams={searchParams}
          />
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
                  <PasswordField />
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
        </VStack>
      </VStack>
    </LoggedOutWrapper>
  );
}

export default LoginPage;
