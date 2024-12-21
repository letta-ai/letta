export interface RequestMiddlewareType {
  organizationId: string;
  userId: string;
  lettaAgentsUserId: string;
  source: 'api' | 'web';
}

export interface SDKContext {
  request: RequestMiddlewareType;
}
