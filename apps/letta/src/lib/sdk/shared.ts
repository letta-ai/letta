export interface RequestMiddlewareType {
  organizationId: string;
  userId: string;
}

export interface AuthedRequestType {
  request: RequestMiddlewareType;
}

export const DEPLOYMENT_BASE_URL = `/v1/deployment`;
