import { Resend } from 'resend';
import { environment } from '@letta-cloud/environmental-variables';

export function getResendClient() {
  if (!environment.RESEND_API_KEY) {
    return null;
  }

  return new Resend(environment.RESEND_API_KEY);
}
