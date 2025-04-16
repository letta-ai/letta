declare namespace Express {
  export interface Request {
    actor?: {
      cloudOrganizationId: string;
      cloudUserId: string;
      source: 'api' | 'web';
      coreUserId: string;
      whitelistedHostname?: string;
    };
  }
}
