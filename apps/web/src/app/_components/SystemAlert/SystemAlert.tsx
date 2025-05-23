import './SystemAlert.scss';
import { useGlobalSystemWarning } from '$web/client/hooks/useGlobalSystemWarning/useGlobalSystemWarning';
import { WarningIcon } from '@letta-cloud/ui-component-library';

export function SystemAlert() {
  const systemWarning = useGlobalSystemWarning();

  if (!systemWarning) {
    return null;
  }

  return (
    <div className="system-alert gap-2 border-b border-warning bg-background-warning text-background-warning-content flex items-center px-2 font-bold text-sm">
      <WarningIcon />
      {systemWarning.title}
    </div>
  );
}
