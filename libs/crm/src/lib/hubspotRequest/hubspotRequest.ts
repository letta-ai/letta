import axios from 'axios';

export const hubspotRequest = axios.create({
  baseURL: 'https://api.hubapi.com',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}`,
  },
});
