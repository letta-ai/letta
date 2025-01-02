import { StrictMode, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import * as ReactDOM from 'react-dom/client';
import App from './app/app';
import './styles.scss';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OpenAPI } from '@letta-web/letta-agents-api';
import { NextIntlClientProvider } from 'next-intl';
import { en as adeEn } from '@letta-cloud/shared-ade-components';
import en from './translations/en.json';

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
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </NextIntlClientProvider>
    </QueryClientProvider>
  </StrictMode>,
);
