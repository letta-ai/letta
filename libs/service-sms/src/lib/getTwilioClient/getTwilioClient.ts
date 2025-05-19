import { environment } from '@letta-cloud/config-environment-variables';
import twilio from 'twilio';

export function getTwilioClient() {
  const accountSid = environment.TWILIO_SID;
  const authToken = environment.TWILIO_SECRET;
  return twilio(accountSid, authToken);
}
