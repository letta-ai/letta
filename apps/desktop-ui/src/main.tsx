import { StrictMode, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import * as ReactDOM from 'react-dom/client';
import App from './app/app';
import './i18n';
import './styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OpenAPI } from '@letta-web/letta-agents-api';

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
      <LettaCoreInterceptor />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
