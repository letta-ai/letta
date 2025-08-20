/// <reference types="cypress" />
/// <reference types="@testing-library/cypress" />

declare namespace Cypress {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Chainable<Subject> {
    googleLogin(): void;
    googleLoginWithSession(): void;
    deleteProjectsWithName(name: string): void;
    clearPointerEventLock(): void;
    deleteApiKeyWithName(name: string): void;
    revokeAllClientSideAccessTokens(): void;
    grantAdminAccess(): void;
    importModels(): void;
    seedTestData(): void;
    cleanupTestData(): void;
    createProject(projectName: string): void;
    createIdentity(identityName: string, uniqueIdentifier: string): void;
    createAgentTemplate(templateType: string, agentName: string): void;
    createAgent: (agentName: string) => void;
    editMemoryBlock(content: string): void;
    waitForInteractiveElement(selector: string): void;
    waitForEditableElement(selector: string): void;
    waitForMemoryBlockReady(): void;
    waitForMemoryBlockSaved(): void;
    waitForDeploymentComplete(): void;
    visitWithDevDelay(path: string): void;
    ensureDefaultProject(projectName?: string): void;
    useDefaultProject(): void;
    clearDefaultProject(): void;
    ensureDefaultAgentTemplate(templateType?: string, agentName?: string): void;
    useDefaultAgentTemplate(): void;
    clearDefaultAgentTemplate(): void;
    ensureDefaultAgent(agentName?: string, templateName?: string): void;
    useDefaultAgent(): void;
    clearDefaultAgent(): void;
    seedDefaultProject(projectName?: string): void;
    seedDefaultAgentTemplate(templateType?: string, agentName?: string): void;
    testStep(stepName: string, fn: () => void): void;
    stageAndDeployAgent(): void;
    clearAllCachedData(): void;
    freshTestStart(): void;
    createEntitiesFromTemplate(options: {
      templateVersion: string;
      agentName: string;
      tags?: string[];
      memoryVariables?: Record<string, string>;
      toolVariables?: Record<string, string>;
      identityIds?: string[];
      initialMessageSequence?: any[];
    }): Cypress.Chainable<{ agents: import('@letta-cloud/sdk-core').AgentState[] }>;
    getTemplateSnapshot(templateVersion: string): Cypress.Chainable<import('@letta-cloud/utils-shared').TemplateSnapshotSchemaType>;
    getCurrentTemplateFromUrl(): Cypress.Chainable<{
      projectSlug: string;
      templateName: string;
      templateVersion: string;
      fullTemplateVersion: string;
    }>;

    // Task types for persistent caching
    task(name: 'getProjectSlug', arg: string): Cypress.Chainable<string | null>;
    task(name: 'getProjectId', arg: string): Cypress.Chainable<string | null>;
    task(
      name: 'setProjectSlug',
      arg: { name: string; slug: string; id?: string },
    ): Cypress.Chainable<null>;
    task(name: 'clearProjectSlug', arg: string): Cypress.Chainable<null>;
    task(
      name: 'getTemplateSlug',
      arg: string,
    ): Cypress.Chainable<string | null>;
    task(
      name: 'setTemplateSlug',
      arg: { name: string; slug: string },
    ): Cypress.Chainable<null>;
    task(name: 'clearTemplateSlug', arg: string): Cypress.Chainable<null>;
    task(name: 'getAgentId', arg: string): Cypress.Chainable<string | null>;
    task(
      name: 'setAgentId',
      arg: { name: string; id: string },
    ): Cypress.Chainable<null>;
    task(name: 'clearAgentId', arg: string): Cypress.Chainable<null>;
    task(name: 'clearAllCache'): Cypress.Chainable<null>;
  }
}
