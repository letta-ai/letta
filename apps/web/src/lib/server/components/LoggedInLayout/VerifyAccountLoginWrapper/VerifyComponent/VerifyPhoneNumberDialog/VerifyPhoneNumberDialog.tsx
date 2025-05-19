import { contracts, webApi } from '@letta-cloud/sdk-web';
import {
  Button,
  Dialog,
  Form,
  FormActions,
  FormField,
  Input,
  PhoneInput,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider } from 'react-hook-form';
import { useTranslations } from '@letta-cloud/translations';
import { useErrorTranslationMessage } from '@letta-cloud/utils-client';
import { isFetchError } from '@ts-rest/react-query/v5';

const submitPhoneNumberSchema = z.object({
  phoneNumber: z.string().min(1),
});

type SubmitPhoneNumberFormValues = z.infer<typeof submitPhoneNumberSchema>;

interface SubmitPhoneNumberFormProps {
  onSuccess: (phoneNumber: string) => void;
}

function SubmitPhoneNumberForm(props: SubmitPhoneNumberFormProps) {
  const { onSuccess } = props;

  const [nextResendTime, setNextResendTime] = useState<string | null>(null);
  const { mutate, error, isPending } =
    webApi.user.startPhoneVerification.useMutation();
  const t = useTranslations(
    'VerifyAccountLoginWrapper/VerifyPhoneNumberDialog',
  );

  const [currentTime, setCurrentTime] = useState(new Date());

  const errorResendTime = useMemo(() => {
    if (error && !isFetchError(error) && error.status === 400) {
      return error.body?.nextResendTime;
    }

    return null;
  }, [error]);

  const resendSeconds = useMemo(() => {
    if (errorResendTime) {
      const nextResendTimeDate = new Date(errorResendTime);

      return Math.floor(
        (nextResendTimeDate.getTime() - currentTime.getTime()) / 1000,
      );
    }

    if (!nextResendTime) {
      return 0;
    }

    const nextResendTimeDate = new Date(nextResendTime);

    return Math.floor(
      (nextResendTimeDate.getTime() - currentTime.getTime()) / 1000,
    );
  }, [errorResendTime, currentTime, nextResendTime]);

  const errorMessage = useErrorTranslationMessage(error, {
    contract: contracts.user.startPhoneVerification,
    messageMap: {
      invalidPhoneNumber: t('errors.invalidPhoneNumber'),
      phoneAlreadyVerified: t('errors.phoneAlreadyVerified'),
      tooEarly: t('errors.tooEarly'),
      default: t('errors.default'),
    },
  });

  const isSendDisabled = useMemo(() => {
    if (!nextResendTime) {
      return false;
    }

    const nextResendTimeDate = new Date(nextResendTime);

    return currentTime < nextResendTimeDate;
  }, [nextResendTime, currentTime]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [nextResendTime]);

  const form = useForm<SubmitPhoneNumberFormValues>({
    resolver: zodResolver(submitPhoneNumberSchema),
    defaultValues: {
      phoneNumber: '',
    },
  });

  const handleSubmit = useCallback(
    (data: SubmitPhoneNumberFormValues) => {
      mutate(
        { body: { phoneNumber: data.phoneNumber } },
        {
          onSuccess: (res) => {
            setNextResendTime(res.body.nextResendTime);
            onSuccess(data.phoneNumber);
          },
        },
      );
    },
    [mutate, onSuccess],
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <FormField
          name="phoneNumber"
          render={({ field }) => (
            <PhoneInput
              fullWidth
              label={t('SubmitPhoneNumberForm.label')}
              {...field}
            />
          )}
        />
        <FormActions errorMessage={errorMessage?.message}>
          <Button
            type="submit"
            label={t('SubmitPhoneNumberForm.cta')}
            color="secondary"
            disabled={isSendDisabled}
            busy={isPending}
          />
        </FormActions>
        {typeof resendSeconds === 'number' && resendSeconds > 0 && (
          <Typography>
            {t('SubmitPhoneNumberForm.resend', {
              seconds: resendSeconds,
            })}
          </Typography>
        )}
      </Form>
    </FormProvider>
  );
}

const VerifySMSCodeFormSchema = z.object({
  code: z.string().min(6).max(6),
});

type VerifySMSCodeSchemaType = z.infer<typeof VerifySMSCodeFormSchema>;

interface VerifySMSCodeSchemaProps {
  undo: () => void;
  phoneNumber: string;
}

function VerifySMSCodeSchema(props: VerifySMSCodeSchemaProps) {
  const { undo, phoneNumber } = props;
  const form = useForm<VerifySMSCodeSchemaType>({
    resolver: zodResolver(VerifySMSCodeFormSchema),
    defaultValues: {
      code: '',
    },
  });

  const { mutate, error, isPending } =
    webApi.user.completePhoneVerification.useMutation();

  const t = useTranslations(
    'VerifyAccountLoginWrapper/VerifyPhoneNumberDialog',
  );

  const errorMessage = useErrorTranslationMessage(error, {
    contract: contracts.user.completePhoneVerification,
    messageMap: {
      invalidVerificationCode: t(
        'VerifySMSCodeSchema.errors.invalidVerificationCode',
      ),
      phoneAlreadyVerified: t(
        'VerifySMSCodeSchema.errors.phoneAlreadyVerified',
      ),
      default: t('VerifySMSCodeSchema.errors.default'),
    },
  });

  const handleSubmit = useCallback(
    (data: VerifySMSCodeSchemaType) => {
      mutate(
        { body: { verificationCode: data.code, phoneNumber } },
        {
          onSuccess: () => {
            window.location.reload();
          },
        },
      );
    },
    [mutate, phoneNumber],
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <FormField
          name="code"
          render={({ field }) => (
            <Input
              fullWidth
              label={t('VerifySMSCodeSchema.label')}
              {...field}
            />
          )}
        />
        <FormActions errorMessage={errorMessage?.message}>
          <Button
            type="button"
            label={t('VerifySMSCodeSchema.goBack')}
            color="secondary"
            onClick={undo}
            disabled={isPending}
          />
          <Button
            type="submit"
            label={t('VerifySMSCodeSchema.cta')}
            color="secondary"
            busy={isPending}
          />
        </FormActions>
      </Form>
    </FormProvider>
  );
}

interface VerifyPhoneNumberDialogProps {
  trigger: React.ReactNode;
}

export function VerifyPhoneNumberDialog(props: VerifyPhoneNumberDialogProps) {
  const { trigger } = props;
  const t = useTranslations(
    'VerifyAccountLoginWrapper/VerifyPhoneNumberDialog',
  );
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);

  return (
    <Dialog disableForm hideFooter trigger={trigger} title={t('title')}>
      <VStack paddingBottom>
        <Typography>{t('description')}</Typography>
        {!phoneNumber ? (
          <SubmitPhoneNumberForm
            onSuccess={(phoneNumber) => {
              setPhoneNumber(phoneNumber);
            }}
          />
        ) : (
          <VerifySMSCodeSchema
            undo={() => {
              setPhoneNumber(null);
            }}
            phoneNumber={phoneNumber}
          />
        )}
      </VStack>
    </Dialog>
  );
}
