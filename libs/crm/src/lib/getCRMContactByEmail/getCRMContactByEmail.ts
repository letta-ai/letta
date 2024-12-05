import { hubspotRequest } from '../hubspotRequest/hubspotRequest';
import type { HubspotContactProperties } from '../constants';

export interface GetUserByEmailQuery {
  email: string;
}

interface GetUserByEmailResult {
  id: string;
  properties: HubspotContactProperties;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

interface GetUserByEmailResponse {
  total: number;
  results: GetUserByEmailResult[];
}

export async function getCRMContactByEmail(
  query: GetUserByEmailQuery
): Promise<GetUserByEmailResult | undefined> {
  const res = await hubspotRequest.post<GetUserByEmailResponse>(
    '/crm/v3/objects/contacts/search',
    {
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'email',
              value: query.email,
              operator: 'EQ',
            },
          ],
        },
      ],
    }
  );

  if (res.data.total === 0) {
    return undefined;
  }

  return res.data.results[0];
}
