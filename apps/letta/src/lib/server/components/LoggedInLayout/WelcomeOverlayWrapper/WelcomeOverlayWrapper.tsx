'use client';

import React, { useCallback, useState } from 'react';
import {
  Button,
  Checkbox,
  ChipSelect,
  FadeInImage,
  Form,
  FormField,
  FormProvider,
  HStack,
  LettaLoader,
  OptionTypeSchemaSingle,
  Typography,
  useForm,
  VStack,
} from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ThemeSelector } from '$letta/client/components/ThemeSelector/ThemeSelector';
import { LocaleSelector } from '$letta/client/components/LocaleSelector/LocaleSelector';
import WelcomeImage from './welcome-image.webp';
import { cn } from '@letta-web/core-style-config';
import './WelcomeOverlay.scss';
import { useCurrentUser } from '$letta/client/hooks';
import { useQueryClient } from '@tanstack/react-query';
import type { GetUser200ResponseType } from '$letta/web-api/user/userContracts';
import { webApi, webApiQueryKeys } from '$letta/client';

const welcomeFormSchema = z.object({
  useCases: OptionTypeSchemaSingle.array(),
  reasons: OptionTypeSchemaSingle.array(),
  emailConsent: z.boolean(),
});

type WelcomeFormValues = z.infer<typeof welcomeFormSchema>;

interface WelcomeOverlayWrapperProps {
  children: React.ReactNode;
}

export function WelcomeOverlayWrapper(props: WelcomeOverlayWrapperProps) {
  const { children } = props;
  const user = useCurrentUser();
  const t = useTranslations('WelcomeOverlay');

  const queryClient = useQueryClient();

  const form = useForm<WelcomeFormValues>({
    resolver: zodResolver(welcomeFormSchema),
    defaultValues: {
      useCases: [],
      reasons: [],
      emailConsent: true,
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isSuccess, mutate } = webApi.user.setUserAsOnboarded.useMutation();

  const handleSubmit = useCallback(
    (values: WelcomeFormValues) => {
      setIsSubmitting(true);

      setTimeout(() => {
        mutate(
          {
            body: {
              reasons: values.reasons.map((v) => v.value || ''),
              emailConsent: values.emailConsent,
              useCases: values.useCases.map((v) => v.value || ''),
            },
          },
          {
            onSuccess: () => {
              setTimeout(() => {
                queryClient.setQueriesData<GetUser200ResponseType | undefined>(
                  {
                    queryKey: webApiQueryKeys.user.getCurrentUser,
                  },
                  (oldData) => {
                    if (!oldData) {
                      return oldData;
                    }

                    return {
                      ...oldData,
                      body: {
                        ...oldData.body,
                        hasOnboarded: true,
                      },
                    };
                  }
                );
              }, 500);
            },
          }
        );
      }, 2500);
    },
    [mutate, queryClient]
  );

  if (!user || user.hasOnboarded) {
    return children;
  }

  return (
    <VStack
      fullWidth
      fullHeight
      /* eslint-disable-next-line react/forbid-component-props */
      className={cn(
        'h-[100dvh] welcome-overlay-wrapper',
        isSubmitting ? 'submitting' : '',
        isSuccess ? 'transition-opacity opacity-0 duration-500' : ''
      )}
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
        <div className="overflow-hidden relative flex inner-container-flexer">
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
                {t('welcomeMessage')}
              </Typography>
              <HStack>
                <LocaleSelector />
                <ThemeSelector />
              </HStack>
            </HStack>
            <Typography align="left" variant="heading5">
              {t('question')}
            </Typography>
            <FormProvider {...form}>
              <Form onSubmit={form.handleSubmit(handleSubmit)}>
                <VStack fullWidth paddingY="large" gap="form">
                  <FormField
                    name="useCases"
                    render={({ field }) => {
                      return (
                        <ChipSelect
                          labelVariant="simple"
                          onChange={(value) => {
                            field.onChange(value);
                          }}
                          isMultiSelect
                          value={field.value}
                          fullWidth
                          label={t('useCases.label')}
                          options={[
                            {
                              value: 'customerService',
                              label: t('useCases.options.customerService'),
                            },
                            {
                              value: 'personalAssistant',
                              label: t('useCases.options.personalAssistant'),
                            },
                            {
                              value: 'entertainment',
                              label: t('useCases.options.entertainment'),
                            },
                            {
                              value: 'chatbots',
                              label: t('useCases.options.chatbots'),
                            },
                            {
                              value: 'taskOrchestration',
                              label: t('useCases.options.taskOrchestration'),
                            },
                            {
                              value: 'experimentation',
                              label: t('useCases.options.experimentation'),
                            },
                          ]}
                        />
                      );
                    }}
                  />
                  <FormField
                    name="reasons"
                    render={({ field }) => {
                      return (
                        <ChipSelect
                          labelVariant="simple"
                          onChange={(value) => {
                            field.onChange(value);
                          }}
                          isMultiSelect
                          value={field.value}
                          fullWidth
                          label={t('reasons.label')}
                          options={[
                            {
                              value: 'restAPI',
                              label: t('reasons.options.restAPI'),
                            },
                            {
                              value: 'personalAssistant',
                              label: t('reasons.options.memory'),
                            },
                            {
                              value: 'toolExecution',
                              label: t('reasons.options.toolExecution'),
                            },
                            {
                              value: 'userPersonalization',
                              label: t('reasons.options.userPersonalization'),
                            },
                            {
                              value: 'openModelSupport',
                              label: t('reasons.options.openModelSupport'),
                            },
                            {
                              value: 'chainOfThoughtReasoning',
                              label: t(
                                'reasons.options.chainOfThoughtReasoning'
                              ),
                            },
                            {
                              value: 'deployingAgentsAtScale',
                              label: t(
                                'reasons.options.deployingAgentsAtScale'
                              ),
                            },
                          ]}
                        />
                      );
                    }}
                  />
                  <FormField
                    name="emailConsent"
                    render={({ field }) => {
                      return (
                        <Checkbox
                          labelVariant="simple"
                          label={t('emailConsent.label')}
                          onCheckedChange={field.onChange}
                          checked={field.value}
                        />
                      );
                    }}
                  />
                </VStack>
                <HStack justify="spaceBetween">
                  <Button
                    data-testid="complete-onboarding"
                    color="secondary"
                    label={t('submit')}
                    type="submit"
                  />
                </HStack>
              </Form>
            </FormProvider>
          </VStack>
          <div className="image-render-container absolute z-[-1px] flex items-end bg-[#0707ab] w-full h-full">
            <div className="loader opacity-0 w-full flex h-full items-center absolute justify-center">
              <LettaLoader color="steel" size="large" />
            </div>
            <FadeInImage src={WelcomeImage} alt="" />
          </div>
        </div>
      </HStack>
    </VStack>
  );
}
