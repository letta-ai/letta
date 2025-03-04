export interface ActorIdentity {
  cloudOrganizationId: string;
  cloudUserId: string;
  source: 'api' | 'web';
  coreUserId: string;
}
