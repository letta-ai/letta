import { webApi } from '@letta-cloud/sdk-web';
import { Button, toast } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

export function ResumePlanButton() {
  const { isPending, mutate, isSuccess } =
    webApi.organizations.resumeOrganizationSubscription.useMutation({
      onSuccess: () => {
        window.location.reload();
      },
      onError: () => {
        toast.error(t('error'));
      },
    });

  const t = useTranslations('components/ResumePlanButton');

  return (
    <Button
      onClick={() => {
        mutate({});
      }}
      size="small"
      busy={isPending || isSuccess}
      label={t('title')}
    />
  );
}
