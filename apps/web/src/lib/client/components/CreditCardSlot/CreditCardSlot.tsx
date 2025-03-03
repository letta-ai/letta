import { type contracts, webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import type { CreditCardType } from '@letta-cloud/sdk-web';
import { useTranslations } from '@letta-cloud/translations';
import {
  AmexCardIcon,
  Badge,
  Button,
  Dialog,
  DiscoverCardIcon,
  HStack,
  MastercardCardIcon,
  StripeCardIcon,
  TrashIcon,
  Typography,
  VisaCardIcon,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ServerInferResponses } from '@ts-rest/core';
import { Slot } from '@radix-ui/react-slot';

interface SetDefaultCreditCardDialogProps {
  paymentMethodId: string;
}

function SetDefaultCreditCardDialog(props: SetDefaultCreditCardDialogProps) {
  const { paymentMethodId } = props;

  const t = useTranslations('organization/billing');

  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = React.useState(false);

  const { mutate, isError, isPending } =
    webApi.organizations.setDefaultOrganizationBillingMethod.useMutation({
      onSuccess: () => {
        setIsOpen(false);
        queryClient.setQueriesData<
          ServerInferResponses<
            typeof contracts.organizations.getCurrentOrganizationBillingInfo,
            200
          >
        >(
          {
            queryKey:
              webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
          },
          (oldData) => {
            if (!oldData) {
              return oldData;
            }
            return {
              ...oldData,
              body: {
                ...oldData.body,
                creditCards: oldData.body.creditCards.map((creditCard) => ({
                  ...creditCard,
                  isDefault: creditCard.id === paymentMethodId,
                })),
              },
            };
          },
        );
      },
    });

  const handleSetDefault = useCallback(() => {
    mutate({
      params: {
        methodId: paymentMethodId,
      },
    });
  }, [paymentMethodId, mutate]);

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      errorMessage={isError ? t('SetDefaultCreditCardDialog.error') : undefined}
      title={t('SetDefaultCreditCardDialog.title')}
      onConfirm={handleSetDefault}
      isConfirmBusy={isPending}
      confirmText={t('SetDefaultCreditCardDialog.confirm')}
      trigger={
        <Button
          size="xsmall"
          label={t('SetDefaultCreditCardDialog.trigger')}
          color="tertiary"
        />
      }
    >
      {t('SetDefaultCreditCardDialog.description')}
    </Dialog>
  );
}

interface RemoveCreditCardDialogProps {
  paymentMethodId: string;
}

function RemoveCreditCardDialog(props: RemoveCreditCardDialogProps) {
  const { paymentMethodId } = props;
  const t = useTranslations('organization/billing');
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = React.useState(false);

  const { mutate, isPending } =
    webApi.organizations.removeOrganizationBillingMethod.useMutation({
      onSuccess: () => {
        setIsOpen(false);
        queryClient.setQueriesData<
          ServerInferResponses<
            typeof contracts.organizations.getCurrentOrganizationBillingInfo,
            200
          >
        >(
          {
            queryKey:
              webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
          },
          (oldData) => {
            if (!oldData) {
              return oldData;
            }
            return {
              ...oldData,
              body: {
                ...oldData.body,
                creditCards: oldData.body.creditCards.filter(
                  (creditCard) => creditCard.id !== paymentMethodId,
                ),
              },
            };
          },
        );
      },
    });
  const removeCreditCard = useCallback(() => {
    mutate({
      params: {
        methodId: paymentMethodId,
      },
    });
  }, [paymentMethodId, mutate]);

  return (
    <Dialog
      title={t('RemoveCreditCardDialog.title')}
      onConfirm={removeCreditCard}
      onOpenChange={setIsOpen}
      isOpen={isOpen}
      isConfirmBusy={isPending}
      confirmColor="destructive"
      confirmText={t('RemoveCreditCardDialog.confirm')}
      trigger={
        <Button
          preIcon={<TrashIcon />}
          label={t('RemoveCreditCardDialog.trigger')}
          hideLabel
          color="tertiary"
        />
      }
    >
      {t('RemoveCreditCardDialog.description')}
    </Dialog>
  );
}

interface CreditCardOverrideIconProps {
  brand: string;
}

function CreditCardOverrideIcon(props: CreditCardOverrideIconProps) {
  const { brand } = props;

  const icon = (() => {
    if (brand === 'visa') {
      return <VisaCardIcon />;
    }

    if (brand === 'mastercard') {
      return <MastercardCardIcon />;
    }

    if (brand === 'amex') {
      return <AmexCardIcon />;
    }

    if (brand === 'discover') {
      return <DiscoverCardIcon />;
    }

    return <StripeCardIcon />;
  })();

  return (
    <Slot
      /* eslint-disable-next-line react/forbid-component-props */
      className="h-[48px] w-auto"
    >
      {icon}
    </Slot>
  );
}

interface CreditCardSlotProps {
  creditCard: CreditCardType;
  disabled?: boolean;
}

export function CreditCardSlot(props: CreditCardSlotProps) {
  const { disabled } = props;
  const { id, last4, brand, isDefault, expMonth, expYear } = props.creditCard;
  const t = useTranslations('organization/billing');

  return (
    <VStack gap={false} border>
      <VStack fullWidth>
        <HStack padding="small" align="center" justify="spaceBetween">
          <HStack align="center">
            <CreditCardOverrideIcon brand={brand} />

            <VStack gap={false} align="start">
              <Typography align="left">
                {t('CreditCardSlot.endingIn', { last4 })}
              </Typography>
              <Typography align="left" variant="body2">
                {t('CreditCardSlot.expires', {
                  month: expMonth,
                  year: expYear,
                })}
              </Typography>
            </VStack>
          </HStack>
          {!disabled && (
            <HStack align="center">
              {isDefault ? (
                <Badge content={t('CreditCardSlot.default')} variant="info" />
              ) : (
                <HStack align="center">
                  <SetDefaultCreditCardDialog paymentMethodId={id} />
                  <RemoveCreditCardDialog paymentMethodId={id} />
                </HStack>
              )}
            </HStack>
          )}
        </HStack>
      </VStack>
    </VStack>
  );
}
