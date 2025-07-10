import { usePauseOnboarding } from '@letta-cloud/sdk-web';
import { useTranslations } from '@letta-cloud/translations';
import { Dialog } from '../../core/Dialog/Dialog';

export const QUICK_ADE_TOUR_STEP = 'quick_ade_tour_step';

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
    <Dialog
      trigger={trigger}
      title={t('title')}
      onConfirm={() => {
        window.localStorage.removeItem(QUICK_ADE_TOUR_STEP);
        pauseOnboarding();
      }}
    >
      {t('description')}
    </Dialog>
  );
}
