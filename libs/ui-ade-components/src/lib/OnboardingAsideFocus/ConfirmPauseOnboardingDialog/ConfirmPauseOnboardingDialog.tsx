import { usePauseOnboarding } from '@letta-cloud/sdk-web';
import { useTranslations } from '@letta-cloud/translations';
import { Dialog } from '@letta-cloud/ui-component-library';
import {
  QUICK_ADE_TOUR_STEP,
  useResetQuickADETour,
} from '../../hooks/useQuickADETour/useQuickADETour';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';

interface ConfirmPauseOnboardingDialogProps {
  trigger: React.ReactNode;
  onboardingType?: string;
}

export function ConfirmPauseOnboardingDialog(
  props: ConfirmPauseOnboardingDialogProps,
) {
  const { pauseOnboarding } = usePauseOnboarding();
  const reset = useResetQuickADETour();
  const t = useTranslations('ConfirmPauseOnboardingDialog');
  const { trigger, onboardingType } = props;

  return (
    <Dialog
      trigger={trigger}
      title={t('title')}
      onConfirm={() => {
        trackClientSideEvent(AnalyticsEvent.SKIP_USER_ONBOARDING, {
          onboardingType: onboardingType || '',
        });

        reset();
        window.localStorage.removeItem(QUICK_ADE_TOUR_STEP);
        pauseOnboarding();
      }}
    >
      {t('description')}
    </Dialog>
  );
}
