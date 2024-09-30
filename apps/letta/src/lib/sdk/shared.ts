export interface RequestMiddlewareType {
  organizationId: string;
  userId: string;
  lettaAgentsUserId: string;
}

export interface SDKContext {
  request: RequestMiddlewareType;
}
