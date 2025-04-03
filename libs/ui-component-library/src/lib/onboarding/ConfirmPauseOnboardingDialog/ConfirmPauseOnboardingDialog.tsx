import { usePauseOnboarding } from '@letta-cloud/sdk-web';
import { useTranslations } from '@letta-cloud/translations';
import { Dialog } from '../../core/Dialog/Dialog';

interface ConfirmPauseOnboardingDialogProps {
  trigger: React.ReactNode;
}

export function ConfirmPauseOnboardingDialog(
  props: ConfirmPauseOnboardingDialogProps,
) {
  const { pauseOnboarding } = usePauseOnboarding();
  const t = useTranslations('ConfirmPauseOnboardingDialog');
  const { trigger } = props;
  return (
    <Dialog trigger={trigger} title={t('title')} onConfirm={pauseOnboarding}>
      {t('description')}
    </Dialog>
  );
}
