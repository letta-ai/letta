import { getTwilioClient } from '../getTwilioClient/getTwilioClient';
import { LETTA_VERIFICATION_SERVICE_SID } from '../constants';

interface SendSMSVerificationMessageOptions {
  phoneNumber: string;
}

export async function sendSMSVerificationMessage(
  options: SendSMSVerificationMessageOptions,
) {
  const { phoneNumber } = options;
  const client = getTwilioClient();

  await client.verify.v2
    .services(LETTA_VERIFICATION_SERVICE_SID)
    .verifications.create({
      channel: 'sms',
      to: phoneNumber,
    });
}
