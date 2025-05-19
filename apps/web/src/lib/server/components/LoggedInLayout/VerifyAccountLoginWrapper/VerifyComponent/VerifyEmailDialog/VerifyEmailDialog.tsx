import { useTranslations } from '@letta-cloud/translations';
import { webApi, webApiContracts } from '@letta-cloud/sdk-web';
import { useEffect, useRef, useState } from 'react';
import { Dialog, toast } from '@letta-cloud/ui-component-library';
import { useErrorTranslationMessage } from '@letta-cloud/utils-client';

interface VerifyEmailDialogProps {
  trigger: React.ReactNode;
}

export function VerifyEmailDialog(props: VerifyEmailDialogProps) {
  const { trigger } = props;

  const t = useTranslations('VerifyAccountLoginWrapper/VerifyEmailDialog');

  const sentInitialVerify = useRef(false);
  const { mutate, error, isPending } =
    webApi.user.startEmailVerification.useMutation({
      onSuccess: () => {
        toast.success(t('success'));
      },
    });

  const [open, setOpen] = useState(false);

  const errorMessage = useErrorTranslationMessage(error, {
    messageMap: {
      tooEarly: t('errors.tooEarly'),
      invalidEmail: t('errors.invalidEmail'),
      emailAlreadyVerified: t('errors.emailAlreadyVerified'),
      default: t('errors.default'),
    },
    contract: webApiContracts.user.startEmailVerification,
  });

  useEffect(() => {
    if (open) {
      if (!sentInitialVerify.current) {
        sentInitialVerify.current = true;
        mutate({});
      }
    }
  }, [mutate, open]);

  return (
    <Dialog
      trigger={trigger}
      isOpen={open}
      title={t('title')}
      onOpenChange={setOpen}
      errorMessage={errorMessage?.message}
      isConfirmBusy={isPending}
      onConfirm={() => {
        mutate({});
      }}
      hideCancel
      confirmText={t('resend')}
    >
      {t('description')}
    </Dialog>
  );
}
