'use client';
import * as React from 'react';
import { useContext, useMemo } from 'react';
import { OpenAPI } from '@letta-cloud/sdk-core';
import { createContext, useEffect } from 'react';
import { useResetAllLettaAgentsQueryKeys } from '@letta-cloud/sdk-core';

OpenAPI.BASE = '';
OpenAPI.HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache',
};

interface LettaAgentsAPIWrapperProps {
  children: React.ReactNode;
  baseUrl: string;
  password?: string;
}

let currentBaseUrl = '';

interface LettaAgentsAPIContextData {
  baseUrl: string;
  password?: string;
}

const LettaAgentsAPIContext = createContext<LettaAgentsAPIContextData>({
  baseUrl: '',
});

export function useLettaAgentsAPI() {
  return useContext(LettaAgentsAPIContext);
}

export function LettaAgentsAPIWrapper({
  children,
  baseUrl: _baseUrl,
  password,
}: LettaAgentsAPIWrapperProps) {
  const { resetAllLettaAgentsQueryKeys } = useResetAllLettaAgentsQueryKeys();
  const baseUrl = useMemo(() => {
    return _baseUrl;
  }, [_baseUrl]);

  useEffect(() => {
    if (currentBaseUrl !== baseUrl) {
      currentBaseUrl = baseUrl;

      resetAllLettaAgentsQueryKeys();
    }

    OpenAPI.interceptors.request.use((config) => {
      config.baseURL = baseUrl;

      if (password) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        config.headers['Authorization'] = `Bearer ${password}`;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        config.headers['X-BARE-PASSWORD'] = `password ${password}`;
      }

      return config;
    });

    return () => {
      OpenAPI.interceptors.request.use((config) => {
        config.baseURL = '';
        return config;
      });
    };
  }, [baseUrl, password, resetAllLettaAgentsQueryKeys]);

  return React.createElement(
    LettaAgentsAPIContext.Provider,
    { value: { baseUrl, password } },
    children,
  );
}
