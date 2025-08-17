import '@testing-library/cypress/add-commands';
import 'cypress-wait-until';

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

Cypress.Commands.add('revokeAllClientSideAccessTokens', () => {
  cy.request({
    method: 'POST',
    url: '/aia/revoke-all-client-side-access-tokens',
    headers: {
      'Content-Type': 'application/json',
    },
  });
});

Cypress.Commands.add('createProject', (projectName: string) => {
  cy.findAllByTestId('create-project-button').first().click();
  cy.findByTestId('project-name-input').type(projectName);
  cy.findByTestId('create-project-dialog-confirm-button').click();
  cy.location('pathname', { timeout: 50000 }).should(
    'match',
    /\/projects\/(.+)/,
  );
});

Cypress.Commands.add(
  'createIdentity',
  (identityName: string, uniqueIdentifier: string) => {
    cy.findAllByTestId('start-create-identity', { timeout: 50000 })
      .first()
      .click();
    cy.findByTestId('identity-name-input').type(identityName);
    cy.findByTestId('unique-identifier-input').type(uniqueIdentifier);
    cy.findByTestId('create-identity-dialog-confirm-button').click();
  },
);

Cypress.Commands.add(
  'createAgentTemplate',
  (templateType: string, agentName: string) => {
    cy.findAllByTestId('create-agent-template-button', { timeout: 50000 })
      .first()
      .click();
    cy.findByTestId(`image-card:${templateType}`).click();
    cy.location('pathname', { timeout: 50000 }).should(
      'match',
      /\/projects\/(.+)\/templates\/(.+)/,
    );

    cy.findByTestId('update-agent-name-button').click();
    cy.findByTestId('update-name-dialog-update-name').invoke('val', '');
    cy.findByTestId('update-name-dialog-update-name').type(agentName);
    cy.findByTestId('update-name-dialog-confirm-button').click();
    cy.location('pathname', { timeout: 50000 }).should(
      'match',
      new RegExp(`/projects/(.+)/templates/${agentName}`),
    );
  },
);

Cypress.Commands.add('editMemoryBlock', (content: string) => {
  cy.findByTestId('edit-memory-block-human-content', {
    timeout: 50000,
  }).dblclick();
  cy.findByTestId('edit-memory-block-human-content', { timeout: 50000 }).type(
    content,
    { parseSpecialCharSequences: false },
  );
  cy.findByTestId('edit-memory-block-human-content-save').click();
  cy.findByTestId('edit-memory-block-human-content-lock', {
    timeout: 5000,
  }).click();
  // wait for the variables to be saved
  // eslint-disable-next-line cypress/no-unnecessary-waiting
  cy.wait(2000);
});

Cypress.Commands.add('stageAndDeployAgent', () => {
  cy.clearPointerEventLock();
  cy.findByTestId('stage-new-version-button', { timeout: 50000 }).click({
    force: true,
  });
  cy.findByTestId('version-agent-dialog-migrate-checkbox').click();
  cy.findByTestId('deploy-agent-dialog-trigger', { timeout: 50000 }).click();
});
