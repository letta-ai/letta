import { hubspotRequest } from '../hubspotRequest/hubspotRequest';

export interface GetUserByEmailQuery {
  email: string;
}

interface GetUserByEmailResult {
  id: string;
  properties: {
    createdate: string;
    email: string;
    firstname: string;
    hs_object_id: string;
    lastmodifieddate: string;
    lastname: string;
  };
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

interface GetUserByEmailResponse {
  total: number;
  results: GetUserByEmailResult[];
}

export async function getUserByEmail(
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
