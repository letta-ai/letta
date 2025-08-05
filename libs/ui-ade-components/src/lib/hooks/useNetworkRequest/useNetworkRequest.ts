'use client';
import { atom, useAtom } from 'jotai';
import { useCallback } from 'react';

export interface NetworkRequest {
  id?: string;
  date: Date;
  url: string;
  method: string;
  status?: number;
  payload: any;
  response: any;
}

// create Jotai atom that holds array of network requests objects
const networkRequestsAtom = atom<NetworkRequest[]>([]);

export function useNetworkRequest() {
  const [networkRequests, setNetworkRequests] = useAtom(networkRequestsAtom);

  const addNetworkRequest = useCallback(
    (request: NetworkRequest) => {
      const id = request.id || Math.random().toString(36).substr(2, 9);
      const requestWithId = { ...request, id };
      setNetworkRequests((prev) => [requestWithId, ...prev]);
      return id;
    },
    [setNetworkRequests],
  );

  const updateNetworkRequest = useCallback(
    (id: string, updates: Partial<NetworkRequest>) => {
      setNetworkRequests((prev) =>
        prev.map((request) =>
          request.id === id ? { ...request, ...updates } : request,
        ),
      );
    },
    [setNetworkRequests],
  );

  /*
    const clearNetworkRequests = useCallback(() => {
        setNetworkRequests(([]));
    }, [setNetworkRequests])
  */

  return { networkRequests, addNetworkRequest, updateNetworkRequest };
}
