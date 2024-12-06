import axios from 'axios';
import { environment } from '@letta-web/environmental-variables';

export const hubspotRequest = axios.create({
  baseURL: 'https://api.hubapi.com',
  headers: {
    'Content-Type': 'application/json',
    authorization: `Bearer ${environment.HUBSPOT_API_KEY}`,
  },
});
