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
import {
  en as componentTranslations,
  Toaster,
} from '@letta-cloud/ui-component-library';
import { PHProvider } from '@letta-cloud/service-analytics/client';

const root = ReactDOM.createRoot(document.getElementById('root')!);

const queryClient = new QueryClient();

function LettaCoreInterceptor() {

  useEffect(() => {
    OpenAPI.interceptors.request.use((config) => {
      // Use the configured URL based on server type
      config.baseURL = '';

      return config;
    });
  }, []);

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
            <App />

          </HashRouter>
        </NextIntlClientProvider>
      </PHProvider>
    </QueryClientProvider>
  </StrictMode>,
);
