import { useCallback, useState } from 'react';
import {
  mostRecentErrorRequestIdAtom,
  useOpenNetworkInspectorWithRequest,
} from '../useNetworkInspectorVisibility/useNetworkInspectorVisibility';
import { useAtom } from 'jotai';
import { useNetworkRequest } from '../useNetworkRequest/useNetworkRequest';

export function useNetworkInspector() {
  const [open, setOpen] = useState(false);
  const [mostRecentErrorRequestId, setMostRecentErrorRequestId] = useAtom(
    mostRecentErrorRequestIdAtom,
  );
  const openNetworkInspectorWithRequest = useOpenNetworkInspectorWithRequest();
  const { networkRequests } = useNetworkRequest();

  const handleInspectError = useCallback(() => {
    setOpen(false);
    setMostRecentErrorRequestId(null);

    if (mostRecentErrorRequestId) {
      openNetworkInspectorWithRequest(mostRecentErrorRequestId);
    } else {
      const mostRecentError = networkRequests.find(
        (req) => req.status && req.status >= 400,
      );
      if (mostRecentError?.id) {
        openNetworkInspectorWithRequest(mostRecentError.id);
      } else {
        openNetworkInspectorWithRequest();
      }
    }
  }, [
    mostRecentErrorRequestId,
    openNetworkInspectorWithRequest,
    networkRequests,
    setOpen,
    setMostRecentErrorRequestId,
  ]);

  const handleInspectErrorWithClose = useCallback(
    (onClose: () => void) => {
      onClose();
      setMostRecentErrorRequestId(null);
      if (mostRecentErrorRequestId) {
        openNetworkInspectorWithRequest(mostRecentErrorRequestId);
      } else {
        const mostRecentError = networkRequests.find(
          (req) => req.status && req.status >= 400,
        );
        if (mostRecentError?.id) {
          openNetworkInspectorWithRequest(mostRecentError.id);
        } else {
          openNetworkInspectorWithRequest();
        }
      }
    },
    [
      mostRecentErrorRequestId,
      openNetworkInspectorWithRequest,
      networkRequests,
      setMostRecentErrorRequestId,
    ],
  );

  return {
    open,
    setOpen,
    handleInspectError,
    handleInspectErrorWithClose,
  };
}
