import './SystemAlert.scss';
import { useGlobalSystemWarning } from '$web/client/hooks/useGlobalSystemWarning/useGlobalSystemWarning';
import { WarningIcon } from '@letta-cloud/ui-component-library';

export function SystemAlert() {
  const systemWarning = useGlobalSystemWarning();

  if (!systemWarning) {
    return null;
  }

  return (
    <>
      <div className="system-alert" />
      <div className="system-alert z-10 overflow-auto  top-0 w-full fixed gap-2 border-b border-warning bg-background-warning text-background-warning-content flex  px-2 font-bold text-sm">
        {/* eslint-disable-next-line react/forbid-component-props */}
        <WarningIcon className="min-w-4" />
        <div className="pt-3">{systemWarning.title}</div>
      </div>
    </>
  );
}
