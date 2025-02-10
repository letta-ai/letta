import '@testing-library/cypress/add-commands';

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

    // complete onboarding if needed
    cy.get('body').then(($btn) => {
      if ($btn.find('[data-testid=complete-onboarding]').length) {
        cy.get('[data-testid=complete-onboarding]').click({ force: true });
      }
    });
  });
});

Cypress.Commands.add('importModels', () => {
  cy.request({
    method: 'POST',
    url: '/aia/import-models',
    headers: {
      'Content-Type': 'application/json',
    },
  });
});

Cypress.Commands.add('clearPointerEventLock', () => {
  cy.get('body').invoke('css', 'user-select', 'auto');
  cy.get('body').invoke('css', 'cursor', 'auto');
  cy.get('body').invoke('css', 'pointer-events', 'auto');
});


Cypress.Commands.add('grantAdminAccess', () => {
  cy.request({
    method: 'POST',
    url: '/aia/grant-admin-access',
    headers: {
      'Content-Type': 'application/json',
    },
  });
});

Cypress.Commands.add('deleteProjectsWithName', (name: string) => {
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

Cypress.Commands.add('deleteApiKeyWithName', (name: string) => {
  cy.request({
    method: 'POST',
    url: '/aia/clean-api-keys-by-name',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {
      name,
    },
  });
});
