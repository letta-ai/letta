import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useMemo } from 'react';
import {
  Alert,
  Button,
  Dialog,
  FormField,
  FormProvider,
  Input,
  LettaCoinIcon,
  LoadingEmptyStatusComponent,
  Switch,
  ToggleGroup,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  webApi,
  type webApiContracts,
  webApiQueryKeys,
} from '@letta-cloud/sdk-web';
import { useQueryClient } from '@tanstack/react-query';
import {
  useFormatters,
} from '@letta-cloud/utils-client';
import { creditsToDollars } from '@letta-cloud/utils-shared';
import type { ServerInferResponses } from '@ts-rest/core';

interface AutoTopUpConfigurationDialogProps {
  trigger: React.ReactNode;
}

interface AutoTopUpConfigurationDialogEditableProps {
  trigger: React.ReactNode;
  isOpened: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues: {
    threshold: number;
    refillAmount: number;
    enabled: boolean;
  };
}

const REFILL_AMOUNTS = [5000, 10000, 25000, 100000] as const;

function useAutoTopUpConfigurationSchema() {
  const t = useTranslations('components/AutoTopUpConfigurationDialog');

  return useMemo(
    () =>
      z.object({
        threshold: z.coerce.number().min(3000, t('errors.thresholdMin')),
        refillAmount: z.coerce
          .number()
          .min(1, t('errors.refillAmountRequired')),
        enabled: z.boolean(),
      }).refine(
        (data) => {
          // Only validate when enabled
          if (!data.enabled) return true;
          return data.threshold < data.refillAmount;
        },
        {
          message: t('errors.thresholdExceedsRefill'),
          path: ['threshold'],
        }
      ),
    [t],
  );
}

type AutoTopUpConfigurationFormValues = z.infer<
  ReturnType<typeof useAutoTopUpConfigurationSchema>
>;


function AutoTopUpConfigurationDialogLoading(
  props: Pick<AutoTopUpConfigurationDialogEditableProps, 'trigger' | 'isOpened' | 'onOpenChange'>,
) {
  const { trigger, isOpened, onOpenChange } = props;
  const t = useTranslations('components/AutoTopUpConfigurationDialog');

  return (
    <Dialog
      isOpen={isOpened}
      onOpenChange={onOpenChange}
      trigger={trigger}
      title={t('title')}
      size="medium"
      color="background"
      hideFooter
    >
      <LoadingEmptyStatusComponent isLoading />
    </Dialog>
  );
}

function AutoTopUpConfigurationDialogEditable(
  props: AutoTopUpConfigurationDialogEditableProps,
) {
  const { trigger, isOpened, onOpenChange, initialValues } = props;
  const t = useTranslations('components/AutoTopUpConfigurationDialog');
  const { formatCurrency, formatNumber } = useFormatters();
  const queryClient = useQueryClient();

  const autoTopUpConfigurationSchema = useAutoTopUpConfigurationSchema();

  const { data: paymentMethods } =
    webApi.organizations.getOrganizationPaymentMethods.useQuery({
      queryKey: webApiQueryKeys.organizations.getOrganizationPaymentMethods,
    });

  const hasDefaultPaymentMethod = useMemo(() => {
    return paymentMethods?.body?.creditCards?.some((card) => card.isDefault) ?? false;
  }, [paymentMethods]);

  const { mutate, error, isPending } =
    webApi.organizations.upsertAutoTopUpConfiguration.useMutation({
      onSuccess: (_data, variables) => {
        queryClient.setQueryData<
          ServerInferResponses<
            typeof webApiContracts.organizations.getAutoTopUpConfiguration
          >
        >(webApiQueryKeys.organizations.getAutoTopUpConfiguration, {
          status: 200,
          body: {
            threshold: variables.body.threshold,
            refillAmount: variables.body.refillAmount,
            enabled: variables.body.enabled,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });
        onOpenChange(false);
      },
    });


  const form = useForm<AutoTopUpConfigurationFormValues>({
    resolver: zodResolver(autoTopUpConfigurationSchema),
    defaultValues: initialValues,
    mode: 'onChange',
  });

  const isEnabled = form.watch('enabled');
  const threshold = form.watch('threshold');
  const refillAmount = form.watch('refillAmount');

  const hasThresholdError = useMemo(() => {
    if (!isEnabled) return false;
    const thresholdNum = typeof threshold === 'string' ? parseInt(threshold, 10) : threshold;
    const refillNum = typeof refillAmount === 'string' ? parseInt(refillAmount, 10) : refillAmount;
    return thresholdNum >= refillNum;
  }, [isEnabled, threshold, refillAmount]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      e.stopPropagation();

      // Validate the form first
      const isValid = await form.trigger();
      if (!isValid || hasThresholdError) {
        return;
      }

      const values = form.getValues();
      mutate({
        body: {
          threshold: parseInt(String(values.threshold), 10),
          refillAmount: parseInt(String(values.refillAmount), 10),
          enabled: values.enabled,
        },
      });
    },
    [form, mutate, hasThresholdError],
  );

  const refillAmountOptions = useMemo(
    () =>
      REFILL_AMOUNTS.map((amount) => ({
        label: formatNumber(amount),
        value: String(amount),
        icon: <LettaCoinIcon />,
      })),
    [formatNumber],
  );

  const thresholdDollarAmount = useMemo(
    () =>
      threshold
        ? formatCurrency(creditsToDollars(threshold), {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2,
            style: 'currency',
            currency: 'USD',
          })
        : null,
    [threshold, formatCurrency],
  );

  const refillAmountDollarAmount = useMemo(
    () =>
      refillAmount
        ? formatCurrency(creditsToDollars(refillAmount), {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2,
            style: 'currency',
            currency: 'USD',
          })
        : null,
    [refillAmount, formatCurrency],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        isOpen={isOpened}
        onOpenChange={onOpenChange}
        trigger={trigger}
        title={t('title')}
        size="medium"
        onSubmit={handleSubmit}
        confirmText={t('save')}
        cancelText={t('cancel')}
        isConfirmBusy={isPending}
        disableSubmit={hasThresholdError || !hasDefaultPaymentMethod}
        errorMessage={error ?  t('errors.default') : ''}
      >
        <VStack gap="xlarge">
          {!hasDefaultPaymentMethod && (
            <Alert
              title={t('noDefaultPaymentMethod.title')}
              variant="warning"
              action={
                <Button
                  href="/upgrade/support"
                  label={t('noDefaultPaymentMethod.action')}
                  size="xsmall"
                />
              }
            >
              {t('noDefaultPaymentMethod.description')}
            </Alert>
          )}

          <FormField
            name="enabled"
            render={({ field }) => (
              <Switch
                label={t('form.enabled.label')}
                description={t('form.enabled.description')}
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={!hasDefaultPaymentMethod}
              />
            )}
          />

          <VStack gap="xlarge" className="relative">
            {!isEnabled && (
              <div className="absolute h-full w-full inset-0 bg-background/50 z-10 pointer-events-none" />
            )}
            <FormField
              name="threshold"
              render={({ field }) => (
                <Input
                  {...field}
                  type="number"
                  fullWidth
                  label={t('form.threshold.label')}
                  description={t('form.threshold.description')}
                  placeholder={t('form.threshold.placeholder')}
                  disabled={!isEnabled}
                  preIcon={<LettaCoinIcon size="small" />}
                  rightOfLabelContent={
                    thresholdDollarAmount ? (
                      <Typography variant="body3" color="lighter">
                        {thresholdDollarAmount}
                      </Typography>
                    ) : null
                  }
                />
              )}
            />

            <FormField
              name="refillAmount"
              render={({ field }) => (
                <ToggleGroup
                  label={t('form.refillAmount.label')}
                  description={t('form.refillAmount.description')}
                  items={refillAmountOptions}
                  value={String(field.value)}
                  onValueChange={async (value) => {
                    if (value) {
                      field.onChange(Number(value));
                      // Re-validate the form to update error messages
                      await form.trigger();
                    }
                  }}
                  disabled={!isEnabled}
                  fullWidth
                  size="xsmall"
                  rightOfLabelContent={
                    refillAmountDollarAmount ? (
                      <Typography variant="body3" color="lighter">
                        {refillAmountDollarAmount}
                      </Typography>
                    ) : null
                  }
                />
              )}
            />
          </VStack>
        </VStack>
      </Dialog>
    </FormProvider>
  );
}

export function AutoTopUpConfigurationDialog(
  props: AutoTopUpConfigurationDialogProps,
) {
  const { trigger } = props;
  const [isOpened, setIsOpened] = React.useState(false);

  const { data, isLoading } =
    webApi.organizations.getAutoTopUpConfiguration.useQuery({
      queryKey: webApiQueryKeys.organizations.getAutoTopUpConfiguration,
    });

  if (isLoading || !data?.body) {
    return (
      <AutoTopUpConfigurationDialogLoading
        trigger={trigger}
        isOpened={isOpened}
        onOpenChange={setIsOpened}
      />
    );
  }

  // Ensure refillAmount is greater than threshold to avoid validation error
  const threshold = data.body.threshold || 5000;
  let refillAmount = data.body.refillAmount || 25000;

  // If they're equal or threshold is higher, default refillAmount to a valid value
  if (threshold >= refillAmount) {
    refillAmount = 25000; // Use second refill option as default
  }

  return (
    <AutoTopUpConfigurationDialogEditable
      trigger={trigger}
      isOpened={isOpened}
      onOpenChange={setIsOpened}
      initialValues={{
        threshold,
        refillAmount,
        enabled: data.body.enabled,
      }}
    />
  );
}
