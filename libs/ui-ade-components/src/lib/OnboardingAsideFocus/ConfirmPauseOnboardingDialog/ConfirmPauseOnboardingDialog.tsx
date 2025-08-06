import { usePauseOnboarding } from '@letta-cloud/sdk-web';
import { useTranslations } from '@letta-cloud/translations';
import { Dialog } from '@letta-cloud/ui-component-library';
import {
  QUICK_ADE_TOUR_STEP,
  useResetQuickADETour,
} from '../../hooks/useQuickADETour/useQuickADETour';

interface ConfirmPauseOnboardingDialogProps {
  trigger: React.ReactNode;
}

export function ConfirmPauseOnboardingDialog(
  props: ConfirmPauseOnboardingDialogProps,
) {
  const { pauseOnboarding } = usePauseOnboarding();
  const reset = useResetQuickADETour();
  const t = useTranslations('ConfirmPauseOnboardingDialog');
  const { trigger } = props;
  return (
    <Dialog
      trigger={trigger}
      title={t('title')}
      onConfirm={() => {
        reset();
        window.localStorage.removeItem(QUICK_ADE_TOUR_STEP);
        pauseOnboarding();
      }}
    >
      {t('description')}
    </Dialog>
  );
}
