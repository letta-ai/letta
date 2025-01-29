import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useMemo } from 'react';
import {
  Alert,
  Button,
  Dialog,
  Form,
  FormActions,
  FormField,
  FormProvider,
  LoadingEmptyStatusComponent,
  Select,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/component-library';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  webApi,
  webApiContracts,
  webApiQueryKeys,
} from '@letta-cloud/web-api-client';
import { CreditCardForm } from '$web/client/components/AddCreditCardDialog/AddCreditCardDialog';
import { useQueryClient } from '@tanstack/react-query';
import { creditsToDollars } from '@letta-cloud/generic-utils';
import {
  useCurrencyFormatter,
  useErrorTranslationMessage,
} from '@letta-cloud/helpful-client-utils';
import { get } from 'lodash-es';
import type { ServerInferResponses } from '@ts-rest/core';

interface PurchaseCreditsDialogProps {
  trigger: React.ReactNode;
}

const purchaseCreditsSchema = z.object({
  credits: z.object({
    value: z.string(),
    label: z.string(),
    description: z.string().optional(),
  }),
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
}

const options: Intl.NumberFormatOptions = {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  style: 'currency',
  currency: 'USD',
};

function PurchaseCreditsForm(props: PurchaseCreditsFormProps) {
  const t = useTranslations('components/PurchaseCreditsDialog');
  const { onComplete } = props;

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
  const { formatCurrency } = useCurrencyFormatter();

  const renderLabel = useCallback(
    (credits: number) => {
      return t('amount.option', {
        price: formatCurrency(creditsToDollars(credits), options),
        credits,
      });
    },
    [t, formatCurrency],
  );

  const errorTranslation = useErrorMessages(error);

  const renderOption = useCallback(
    (credits: number) => {
      return {
        value: credits.toString(),
        label: renderLabel(credits),
      };
    },
    [renderLabel],
  );

  const form = useForm<PurchaseCreditsFormValues>({
    resolver: zodResolver(purchaseCreditsSchema),
    defaultValues: { credits: renderOption(10000) },
  });

  const { data: billingInfo } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  const defaultCard = useMemo(() => {
    if (!billingInfo?.body.creditCards) {
      return undefined;
    }

    return billingInfo.body.creditCards.find((card) => card.isDefault);
  }, [billingInfo]);

  const handleSubmit = useCallback(
    (values: PurchaseCreditsFormValues) => {
      mutate({
        body: {
          credits: parseInt(values.credits.value, 10),
        },
      });
    },
    [mutate],
  );

  return (
    <VStack paddingBottom>
      <FormProvider {...form}>
        <Form onSubmit={form.handleSubmit(handleSubmit)}>
          {errorTranslation && (
            <Alert title={errorTranslation.message} variant="destructive" />
          )}
          <FormField
            name="credits"
            render={({ field }) => (
              <>
                <Select
                  labelVariant="simple"
                  label={t('amount.label')}
                  {...field}
                  options={[
                    renderOption(10000),
                    renderOption(25000),
                    renderOption(50000),
                    renderOption(100000),
                  ]}
                />
                <Typography>
                  {t('confirmation', {
                    credits: field.value.value,
                    price: formatCurrency(
                      creditsToDollars(field.value.value),
                      options,
                    ),
                    last4: defaultCard?.last4 || '0000',
                  })}
                </Typography>
              </>
            )}
          />

          <FormActions>
            <Button type="submit" busy={isPending} label={t('confirm')} />
          </FormActions>
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
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
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
      disableForm
      hideFooter
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
                    webApiQueryKeys.organizations
                      .getCurrentOrganizationBillingInfo,
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
          onComplete={() => {
            setIsOpened(false);
          }}
        />
      )}
    </Dialog>
  );
}
