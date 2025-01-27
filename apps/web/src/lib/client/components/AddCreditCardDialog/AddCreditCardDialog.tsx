import { webApi, webApiQueryKeys } from '@letta-cloud/web-api-client';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { environment } from '@letta-cloud/environmental-variables';
import {
  Alert,
  Button,
  Dialog,
  LoadingEmptyStatusComponent,
  VStack,
} from '@letta-cloud/component-library';
import { useTranslations } from '@letta-cloud/translations';

const stripePromise = loadStripe(environment.NEXT_PUBLIC_STRIPE_PUBLISH_KEY);

interface AddCreditCardDialogProps {
  trigger: React.ReactNode;
}

import { cn } from '@letta-cloud/core-style-config';
import { useQueryClient } from '@tanstack/react-query';

interface CreditCardFormInnerProps {
  setIsLoading: (isLoading: boolean) => void;
  clientSecret: string;
  onComplete: VoidFunction;
}

function CreditCardFormInner(props: CreditCardFormInnerProps) {
  const { setIsLoading, onComplete, clientSecret } = props;
  const t = useTranslations('components/AddCreditCardDialog');
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      try {
        if (!stripe || !elements) {
          return;
        }

        setIsSubmitting(true);

        const { error: submitError } = await elements.submit();
        if (submitError) {
          // Show error to your customer
          setError(submitError.message || '');
          return;
        }

        const { error } = await stripe.confirmSetup({
          elements,
          clientSecret,
          redirect: 'if_required',
        });

        if (error) {
          setError(error.message || '');
          setIsSubmitting(false);
          return;
        }

        onComplete();
      } catch (_error) {
        setError(t('unknownError'));
        setIsSubmitting(false);
      } finally {
        setIsSubmitting(false);
      }
    },
    [stripe, elements, onComplete, clientSecret, t],
  );

  return (
    <form onSubmit={handleSubmit} className="relative min-h-[450px]">
      <VStack paddingBottom="xxlarge" gap="form">
        {error && <Alert title={error} variant="destructive" />}
        <PaymentElement
          id="payment-element"
          onReady={() => {
            setIsLoading(false);
          }}
        />
        <Button
          busy={isSubmitting}
          type="submit"
          fullWidth
          label={t('addCard')}
        />
      </VStack>
    </form>
  );
}

interface CreditCardFormProps {
  onComplete: VoidFunction;
}

function CreditCardForm(props: CreditCardFormProps) {
  const { onComplete } = props;
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setError] = useState(false);
  const [setupIntentClientSecret, setSetupIntentClientSecret] = useState('');

  useEffect(() => {
    setIsLoading(true);
    void webApi.organizations.startSetupIntent.query().then((response) => {
      if (response.status === 200) {
        setSetupIntentClientSecret(response.body.clientSecret);
      } else {
        setIsLoading(false);
        setError(true);
      }
    });
  }, []);

  const styles = getComputedStyle(document.body);

  const t = useTranslations('components/AddCreditCardDialog');

  return (
    <div className="min-h-[250px] transition-all">
      {(isLoading || isError) && (
        <div className="absolute w-full left-0 h-[250px]">
          <LoadingEmptyStatusComponent
            noMinHeight
            loadingMessage={t('isLoading')}
            errorMessage={t('errorLoading')}
            isError={isError}
            isLoading={isLoading}
          />
        </div>
      )}
      {setupIntentClientSecret && (
        <div className={cn(isLoading && 'opacity-0')}>
          <Elements
            stripe={stripePromise}
            options={{
              appearance: {
                theme: 'flat',
                variables: {
                  colorPrimary: `hsl(${styles.getPropertyValue('--primary')})`,
                  colorBackground: `hsl(${styles.getPropertyValue('--background')})`,
                  colorText: `hsl(${styles.getPropertyValue('--text-default')})`,
                  colorDanger: `hsl(${styles.getPropertyValue('--color-destructive')})`,
                  fontFamily: styles.getPropertyValue('--font-sans'),
                  spacingUnit: '4px',
                  borderRadius: '0px',
                },
              },
              clientSecret: setupIntentClientSecret,
            }}
          >
            <CreditCardFormInner
              onComplete={onComplete}
              clientSecret={setupIntentClientSecret}
              setIsLoading={setIsLoading}
            />
          </Elements>
        </div>
      )}
    </div>
  );
}

export function AddCreditCardDialog(props: AddCreditCardDialogProps) {
  const { trigger } = props;
  const t = useTranslations('components/AddCreditCardDialog');
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog
      disableForm
      hideFooter
      title={t('title')}
      trigger={trigger}
      onOpenChange={setIsOpen}
      isOpen={isOpen}
    >
      <CreditCardForm
        onComplete={() => {
          queryClient
            .invalidateQueries({
              queryKey:
                webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
            })
            .then(() => {
              setIsOpen(false);
            })
            .catch(() => {
              window.location.reload();
            });
        }}
      />
    </Dialog>
  );
}
