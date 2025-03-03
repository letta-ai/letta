import axios from 'axios';
import { environment } from '@letta-cloud/config-environment-variables';

export const composioRequest = axios.create({
  baseURL: 'https://backend.composio.dev',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': `${environment.COMPOSIO_API_KEY}`,
  },
});
