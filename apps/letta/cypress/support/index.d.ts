/// <reference types="cypress" />
/// <reference types="@testing-library/cypress" />

declare namespace Cypress {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Chainable<Subject> {
    googleLogin(): void;
    deleteProjectsWithName(name: string): void;
    deleteApiKeyWithName(name: string): void;
  }
}
