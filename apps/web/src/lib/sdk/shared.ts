export interface RequestMiddlewareType {
  headers?: any;
  organizationId: string;
  userId: string;
  lettaAgentsUserId: string;
  source: 'api' | 'web';
  projectSlug?: string;
}

export interface SDKContext {
  request: RequestMiddlewareType;
}
