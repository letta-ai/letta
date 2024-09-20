import '@testing-library/cypress/add-commands';

/// <reference types="cypress" />

// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Cypress {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Chainable<Subject> {
    googleLogin(): void;
    deleteProjectsWithName(name: string): void;
  }
}

Cypress.Commands.add('googleLogin', () => {
  cy.log('Logging in to Google');
  cy.request({
    method: 'POST',
    url: 'https://www.googleapis.com/oauth2/v4/token',
    body: {
      grant_type: 'refresh_token',
      client_id: Cypress.env('googleClientId'),
      client_secret: Cypress.env('googleClientSecret'),
      refresh_token: Cypress.env('googleRefreshToken'),
    },
  }).then(({ body }) => {
    const { id_token } = body;

    cy.visit(`/auth/google/atl?id_token=${id_token}`);
  });
});

Cypress.Commands.add('deleteProjectsWithName', (name: string) => {
  cy.googleLogin();

  cy.request({
    method: 'POST',
    url: '/aia/clean-projects-by-name',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {
      name,
    },
  });
});
