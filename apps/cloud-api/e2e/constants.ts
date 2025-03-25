import axios from 'axios';

export const BASE_URL = process.env.CLOUD_API_URL || 'http://localhost:3006';

console.log('Connecting to API at:', BASE_URL);

export const lettaAxiosSDK = axios.create({
  baseURL: BASE_URL,
  validateStatus: () => true,
});
