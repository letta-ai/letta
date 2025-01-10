import { StrictMode, useEffect } from 'react';
import { HashRouter } from 'react-router-dom';
import * as ReactDOM from 'react-dom/client';
import App from './app/app';
import './styles.scss';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OpenAPI } from '@letta-cloud/letta-agents-api';
import { NextIntlClientProvider } from 'next-intl';
import { en as adeEn } from '@letta-cloud/shared-ade-components';
import en from './translations/en.json';
import { ServerStatusProvider } from './app/hooks/useServerStatus/useServerStatus';
import { Toaster } from '@letta-cloud/component-library';

const root = ReactDOM.createRoot(document.getElementById('root')!);

const queryClient = new QueryClient();

function LettaCoreInterceptor() {
  useEffect(() => {
    OpenAPI.interceptors.request.use((config) => {
      config.baseURL = 'http://localhost:8283';

      return config;
    });
  }, []);

  return null;
}

root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider
        locale="en"
        messages={{
          ...en,
          ...adeEn,
        }}
      >
        <LettaCoreInterceptor />
        <HashRouter>
          <Toaster />
          <ServerStatusProvider>
            <App />
          </ServerStatusProvider>
        </HashRouter>
      </NextIntlClientProvider>
    </QueryClientProvider>
  </StrictMode>,
);
