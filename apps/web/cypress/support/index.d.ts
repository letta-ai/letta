/// <reference types="cypress" />
/// <reference types="@testing-library/cypress" />

declare namespace Cypress {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Chainable<Subject> {
    googleLogin(): void;
    deleteProjectsWithName(name: string): void;
    clearPointerEventLock(): void;
    deleteApiKeyWithName(name: string): void;
    revokeAllClientSideAccessTokens(): void;
    grantAdminAccess(): void;
    importModels(): void;
    createProject(projectName: string): void;
    createIdentity(identityName: string, uniqueIdentifier: string): void;
    createAgentTemplate(templateType: string, agentName: string): void;
    editMemoryBlock(content: string): void;
    stageAndDeployAgent(): void;
  }
}
