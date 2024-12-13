import { composioRequest } from '../composioRequest/composioRequest';

export interface GetAllToolsItem {
  name: string;
  enum: string;
  logo: string;
  tags: string[];
  displayName: string;
  description: string;
  appId: string;
  deprecated: boolean;
  appKey: string;
  display_name: string;
}

interface GetAllToolsResponse {
  items: GetAllToolsItem[];
  totalPages: number;
  page: number;
}

export async function getAllToolsFromComposio() {
  const response = await composioRequest.get<GetAllToolsResponse>(
    '/api/v2/actions?limit=10000000&showAll=true'
  );

  return response.data.items;
}
