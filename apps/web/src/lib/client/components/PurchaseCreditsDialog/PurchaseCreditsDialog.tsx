import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useMemo } from 'react';
import {
  Alert,
  Button,
  Dialog,
  Form,
  FormField,
  FormProvider,
  HStack,
  LettaCoinIcon,
  LoadingEmptyStatusComponent,
  RadioGroup,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { webApi, webApiContracts, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { CreditCardForm } from '$web/client/components/AddCreditCardDialog/AddCreditCardDialog';
import { useQueryClient } from '@tanstack/react-query';
import { creditsToDollars } from '@letta-cloud/utils-shared';
import {
  useErrorTranslationMessage,
  useFormatters,
} from '@letta-cloud/utils-client';
import { get } from 'lodash-es';
import type { ServerInferResponses } from '@ts-rest/core';
import { useFormContext } from 'react-hook-form';
import { CreditCardSlot } from '$web/client/components';
import { useGetDefaultOrFirstCard } from '$web/client/hooks/useGetDefaultOrFirstCard/useGetDefaultOrFirstCard';

interface PurchaseCreditsDialogProps {
  trigger: React.ReactNode;
}

const purchaseCreditsSchema = z.object({
  credits: z.string(),
});

type PurchaseCreditsFormValues = z.infer<typeof purchaseCreditsSchema>;

function useErrorMessages(error: unknown) {
  const t = useTranslations('components/PurchaseCreditsDialog');

  return useErrorTranslationMessage(error, {
    messageMap: {
      paymentError: t('errors.paymentError', {
        error:
          // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
          get(error, 'message') || '',
      }),
      default: t('errors.default'),
    },
    contract: webApiContracts.organizations.purchaseCredits,
  });
}

interface PurchaseCreditsFormProps {
  onComplete: () => void;
  onClose: () => void;
}

const options: Intl.NumberFormatOptions = {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  style: 'currency',
  currency: 'USD',
};

function ConfirmationText() {
  const form = useFormContext();

  const t = useTranslations('components/PurchaseCreditsDialog');
  const credits = form.watch('credits');
  const { formatCurrency } = useFormatters();
  const defaultCard = useGetDefaultOrFirstCard();

  return (
    <VStack gap="xlarge">
      <VStack gap={false}>
        <Typography variant="body3" bold uppercase>
          {t('confirmation.order')}
        </Typography>
        <VStack gap={false}>
          <HStack gap="small" align="center">
          <LettaCoinIcon size="small" />
          <Typography>
            <Typography overrideEl="span" variant="heading3">
              {parseInt(credits).toLocaleString()}
            </Typography>
            {' '}{t('credits')} ({formatCurrency(creditsToDollars(credits), options)})
          </Typography>
          </HStack>
        </VStack>
      </VStack>
      <VStack>
        <Typography variant="body3" bold uppercase>
          {t('confirmation.paymentMethod')}
        </Typography>
        {defaultCard && <CreditCardSlot creditCard={defaultCard} disabled />}
      </VStack>
      <VStack paddingBottom="small">
        <Typography variant="body2">
          {t('confirmation.details', {
            price: formatCurrency(creditsToDollars(credits), options),
            last4: defaultCard?.last4 || '0000',
          })}
        </Typography>
      </VStack>
    </VStack>
  );
}

function PurchaseCreditsForm(props: PurchaseCreditsFormProps) {
  const t = useTranslations('components/PurchaseCreditsDialog');
  const { onComplete, onClose } = props;

  const queryClient = useQueryClient();

  const { mutate, error, isPending } =
    webApi.organizations.purchaseCredits.useMutation({
      onSuccess: (_, input) => {
        queryClient.setQueriesData<
          ServerInferResponses<
            typeof webApiContracts.organizations.getCurrentOrganizationBillingInfo,
            200
          >
        >(
          {
            queryKey:
              webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
          },
          (data) => {
            if (!data) {
              return data;
            }

            if (data.status !== 200) {
              return data;
            }

            return {
              ...data,
              body: {
                ...data.body,
                totalCredits: data.body.totalCredits + input.body.credits,
              },
            };
          },
        );

        onComplete();
      },
    });

  const errorTranslation = useErrorMessages(error);
  const defaultCard = useGetDefaultOrFirstCard();

  const renderOption = useCallback(
    (credits: string) => {
      const creditAmount = parseInt(credits, 10);

      return {
        value: credits.toString(),
        label: (
          <HStack gap="small" align="center">
            <LettaCoinIcon size="small" />
            <Typography variant="heading6">
              {creditAmount.toLocaleString()}
            </Typography>
            <Typography color="lighter">
              {t('credits')}
            </Typography>
          </HStack>
        ),
      };
    },
    [t],
  );

  const form = useForm<PurchaseCreditsFormValues>({
    resolver: zodResolver(purchaseCreditsSchema),
    defaultValues: { credits: '20000' },
  });

  const handleSubmit = useCallback(
    (values: PurchaseCreditsFormValues) => {
      if (!defaultCard) {
        return;
      }

      mutate({
        body: {
          cardId: defaultCard.id,
          credits: parseInt(values.credits, 10),
        },
      });
    },
    [mutate, defaultCard],
  );
  return (
    <VStack paddingBottom>
      <FormProvider {...form}>
        <Form onSubmit={form.handleSubmit(handleSubmit)}>
          {errorTranslation && (
            <Alert title={errorTranslation.message} variant="destructive" />
          )}
          <HStack gap="xlarge">
            <VStack fullWidth>
              <FormField
                name="credits"
                render={({ field }) => (
                  <>
                    <RadioGroup
                      label={t('amount.label')}
                      fullWidth
                      value={field.value}
                      variant="blocky"
                      onValueChange={(value) => {
                        field.onChange(value);
                      }}
                      items={[
                        renderOption('20000'),
                        renderOption('50000'),
                        renderOption('75000'),
                        renderOption('100000'),
                      ]}
                    />
                  </>
                )}
              />
            </VStack>
            <VStack
              fullWidth
              /* eslint-disable-next-line react/forbid-component-props */
              className="max-w-[40%]"
            >
              <ConfirmationText />
              <Button
                fullWidth
                type="submit"
                size="large"
                busy={isPending}
                label={t('confirm')}
              />
              <Button
                fullWidth
                type="button"
                size="large"
                color="tertiary"
                onClick={() => {
                  onClose();
                }}
                label={t('cancel')}
              />
            </VStack>
          </HStack>
        </Form>
      </FormProvider>
    </VStack>
  );
}

export function PurchaseCreditsDialog(props: PurchaseCreditsDialogProps) {
  const { trigger } = props;
  const t = useTranslations('components/PurchaseCreditsDialog');
  const [isOpened, setIsOpened] = React.useState(false);

  const { data, isError } =
    webApi.organizations.getOrganizationPaymentMethods.useQuery({
      queryKey: webApiQueryKeys.organizations.getOrganizationPaymentMethods,
    });

  const queryClient = useQueryClient();

  const viewMode = useMemo(() => {
    if (!data?.body.creditCards) {
      return 'loading';
    }

    if (data.body.creditCards.length === 0) {
      return 'noCreditCard';
    }

    return 'hasCreditCard';
  }, [data]);

  return (
    <Dialog
      isOpen={isOpened}
      onOpenChange={setIsOpened}
      errorMessage={isError ? t('error') : undefined}
      trigger={trigger}
      title={t('title')}
      size={viewMode === 'hasCreditCard' ? 'xlarge' : 'medium'}
      disableForm
      hideFooter
      color="background"
    >
      {viewMode === 'loading' && <LoadingEmptyStatusComponent isLoading />}
      {viewMode === 'noCreditCard' && (
        <VStack>
          <Alert title={t('noCreditCard')} variant="info" />
          <CreditCardForm
            onComplete={() => {
              queryClient
                .invalidateQueries({
                  queryKey:
                    webApiQueryKeys.organizations.getOrganizationPaymentMethods,
                })
                .catch(() => {
                  window.location.reload();
                });
            }}
          />
        </VStack>
      )}

      {viewMode === 'hasCreditCard' && (
        <PurchaseCreditsForm
          onClose={() => {
            setIsOpened(false);
          }}
          onComplete={() => {
            setIsOpened(false);
          }}
        />
      )}
    </Dialog>
  );
}
