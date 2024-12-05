import { hubspotRequest } from '../hubspotRequest/hubspotRequest';
import type { HubspotContactProperties } from '../constants';
import { getCRMContactByEmail } from '../getCRMContactByEmail/getCRMContactByEmail';

export interface CreateContactArguments {
  email: string;
  firstName: string;
  lastName: string;
  consentedToEmailMarketing: boolean;
  reasonsForUsingLetta: string[];
  usesLettaFor: string[];
}

interface CreateContactResponse {
  id: string;
  properties: HubspotContactProperties;
}

async function createContact(
  args: CreateContactArguments
): Promise<CreateContactResponse> {
  const res = await hubspotRequest.post<CreateContactResponse>(
    '/crm/v3/objects/contacts',
    {
      properties: {
        email: args.email,
        firstname: args.firstName,
        lastname: args.lastName,
        consented_to_email_marketing: args.consentedToEmailMarketing,
        reasons_for_using_letta: args.reasonsForUsingLetta.join(','),
        uses_letta_for: args.usesLettaFor.join(','),
      },
    }
  );

  return res.data;
}

interface UpdateContactArguments {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  consentedToEmailMarketing: boolean;
  reasonsForUsingLetta: string[];
  usesLettaFor: string[];
}

interface UpdateContactResponse {
  id: string;
  properties: HubspotContactProperties;
}

async function updateContact(
  args: UpdateContactArguments
): Promise<UpdateContactResponse> {
  const res = await hubspotRequest.patch<UpdateContactResponse>(
    `/crm/v3/objects/contacts/${args.id}`,
    {
      properties: {
        email: args.email,
        firstname: args.firstName,
        lastname: args.lastName,
        consented_to_email_marketing: args.consentedToEmailMarketing,
        reasons_for_using_letta: args.reasonsForUsingLetta.join(','),
        uses_letta_for: args.usesLettaFor.join(','),
      },
    }
  );

  return res.data;
}

export async function createOrUpdateCRMContact(
  args: CreateContactArguments
): Promise<CreateContactResponse> {
  const existingContact = await getCRMContactByEmail({ email: args.email });

  if (existingContact) {
    return updateContact({
      id: existingContact.id,
      ...args,
    });
  }

  return createContact(args);
}
