import { StrictMode, useEffect } from 'react';
import { HashRouter } from 'react-router-dom';
import * as ReactDOM from 'react-dom/client';
import App from './app/app';
import './styles.scss';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OpenAPI } from '@letta-cloud/sdk-core';
import { NextIntlClientProvider } from 'next-intl';
import { en as adeEn } from '@letta-cloud/ui-ade-components';
import en from './translations/en.json';
import { ServerStatusProvider } from './app/hooks/useServerStatus/useServerStatus';
import {
  en as componentTranslations,
  Toaster,
} from '@letta-cloud/ui-component-library';
import { useDesktopConfig } from './app/hooks/useDesktopConfig/useDesktopConfig';
import { PHProvider } from '@letta-cloud/service-analytics/client';

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const root = ReactDOM.createRoot(document.getElementById('root')!);

const queryClient = new QueryClient();

function LettaCoreInterceptor() {
  const { desktopConfig } = useDesktopConfig();

  useEffect(() => {
    OpenAPI.interceptors.request.use((config) => {
      // Use the configured URL based on server type
      if (desktopConfig?.databaseConfig.type === 'cloud') {
        config.baseURL = 'https://api.letta.com';
        // Token is required for cloud
        if (desktopConfig.databaseConfig.token) {
          config.headers = {
            ...config.headers,
            Authorization: `Bearer ${desktopConfig.databaseConfig.token}`,
          };
        }
      } else if (desktopConfig?.databaseConfig.type === 'local') {
        config.baseURL =
          desktopConfig.databaseConfig.url || 'http://localhost:8283';
        // Add token to headers if provided
        if (desktopConfig.databaseConfig.token) {
          config.headers = {
            ...config.headers,
            Authorization: `Bearer ${desktopConfig.databaseConfig.token}`,
          };
        }
      } else {
        // Default for embedded servers
        config.baseURL = 'http://localhost:8283';
      }

      return config;
    });
  }, [desktopConfig]);

  return null;
}

root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PHProvider>
        <NextIntlClientProvider
          locale="en"
          messages={{
            ...en,
            ...adeEn,
            ...componentTranslations,
          }}
        >
          <HashRouter>
            <Toaster />
            <LettaCoreInterceptor />
            <ServerStatusProvider>
              <App />
            </ServerStatusProvider>
          </HashRouter>
        </NextIntlClientProvider>
      </PHProvider>
    </QueryClientProvider>
  </StrictMode>,
);
