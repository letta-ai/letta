import { webApi } from '@letta-cloud/sdk-web';
import { Dialog, toast } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

interface CancelPlanDialogProps {
  trigger: React.ReactNode;
}

export function CancelPlanDialog(props: CancelPlanDialogProps) {
  const { trigger } = props;

  const { isPending, mutate, isSuccess } =
    webApi.organizations.cancelOrganizationSubscription.useMutation({
      onSuccess: () => {
        window.location.reload();
      },
      onError: () => {
        toast.error(t('error'));
      },
    });

  const t = useTranslations('components/CancelPlanDialog');

  return (
    <Dialog
      trigger={trigger}
      title={t('title')}
      onConfirm={() => {
        mutate({});
      }}
      isConfirmBusy={isPending || isSuccess}
    >
      {t('description')}
    </Dialog>
  );
}
