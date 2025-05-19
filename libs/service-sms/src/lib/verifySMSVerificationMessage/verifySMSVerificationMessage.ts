import { getTwilioClient } from '../getTwilioClient/getTwilioClient';
import { LETTA_VERIFICATION_SERVICE_SID } from '../constants';

interface VerifySMSVerificationMessageOptions {
  phoneNumber: string;
  code: string;
}

export async function verifySMSVerificationMessage(
  options: VerifySMSVerificationMessageOptions,
) {
  const { phoneNumber, code } = options;
  const client = getTwilioClient();

  const response = await client.verify.v2
    .services(LETTA_VERIFICATION_SERVICE_SID)
    .verificationChecks.create({
      code,
      to: phoneNumber,
    });

  if (response.status === 'approved') {
    return true;
  }

  return false;
}
