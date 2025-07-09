'use client';
import { atom, useAtom, useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { OpenAPI } from '@letta-cloud/sdk-core';
import type { AxiosResponse } from 'axios';
import { useNetworkRequest } from '../useNetworkRequest/useNetworkRequest';
import { expandedRequestIdAtom } from '../../NetworkInspector/NetworkInspector';

interface NetworkInspectorState {
  isOpen: boolean;
  expandRequestId?: string | null;
}

const networkInspectorVisibilityAtom = atom<NetworkInspectorState>({
  isOpen: false,
  expandRequestId: null,
});

export function useNetworkInspectorVisibility() {
  return useAtom(networkInspectorVisibilityAtom);
}

export function useOpenNetworkInspectorWithRequest() {
  const setNetworkInspectorState = useSetAtom(networkInspectorVisibilityAtom);
  return (requestId?: string) => {
    setNetworkInspectorState({
      isOpen: true,
      expandRequestId: requestId || null,
    });
  };
}

export function useGlobalNetworkInterceptor() {
  const { addNetworkRequest } = useNetworkRequest();
  const setExpandedRequestId = useSetAtom(expandedRequestIdAtom);
  const setMostRecentErrorRequestId = useSetAtom(mostRecentErrorRequestIdAtom);

  useEffect(() => {
    function interceptor(response: AxiosResponse) {
      // filter out GET requests
      if (response.config.method?.toLowerCase() === 'get') {
        return response;
      }

      const networkRequest = {
        date: new Date(),
        url: response.config.url || '',
        method: response.config.method?.toUpperCase() || 'UNKNOWN',
        status: response.status,
        payload: response.config.data,
        response: response.data,
      };

      const id = addNetworkRequest(networkRequest);

      if (response.status >= 400 && id) {
        setMostRecentErrorRequestId(id);
      }

      return response;
    }

    OpenAPI.interceptors.response.use(interceptor);

    return () => {
      OpenAPI.interceptors.response.eject(interceptor);
    };
  }, [addNetworkRequest, setExpandedRequestId, setMostRecentErrorRequestId]);
}

export const mostRecentErrorRequestIdAtom = atom<string | null>(null);
