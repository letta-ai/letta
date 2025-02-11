describe('credit usage', () => {
  beforeEach(() => {
    cy.googleLogin();
    cy.importModels();
    cy.grantAdminAccess();
    cy.request({
      method: 'POST',
      url: '/aia/reset-credits',
      body: {},
      headers: {
        'Content-Type': 'application/json',
      },
    });
    cy.deleteProjectsWithName('CYDOGGCREDITS');
    cy.visit('/signout');
  });

  afterEach(() => {
    cy.googleLogin();

    cy.request({
      method: 'POST',
      url: '/aia/reset-credits',
      body: {},
      headers: {
        'Content-Type': 'application/json',
      },
    });

    cy.deleteProjectsWithName('CYDOGGCREDITS');
  });

  it('should test the credits system', () => {
    Cypress.config('defaultCommandTimeout', 50000);

    cy.visit('/');
    cy.location('pathname').should('eq', '/login');

    cy.googleLogin();

    cy.request({
      method: 'POST',
      url: '/aia/reset-credits',
      body: {
        nextCredits: 159,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    cy.request({
      method: 'POST',
      url: '/aia/step-costs',
      body: {
        modelName: 'gpt-4o-mini',
        stepCost: 95,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    cy.visit('/settings/organization/billing');

    cy.findByTestId('total-credits', {
      timeout: 50000,
    }).contains('159');

    cy.visit('/');

    cy.get('h1').contains(/Projects/);

    // creates a project
    cy.findAllByTestId('create-project-button').first().click();

    cy.findByTestId('project-name-input').type('CYDOGGRATELIMIT');

    cy.findByTestId('create-project-dialog-confirm-button').click();

    // creates an agent
    cy.findAllByTestId('create-agent-template-button', { timeout: 50000 })
      .first()
      .click();

    cy.findByTestId('image-card:Customer support').click();

    cy.location('pathname', { timeout: 50000 }).should(
      'match',
      /\/projects\/(.+)\/templates\/(.+)/,
    );

    cy.findAllByTestId('agent-message-content', { timeout: 50000 })
      .its('length')
      .should('eq', 1);

    cy.findByTestId('chat-simulator-input').type('What is my name', {
      force: true,
    });

    cy.findByTestId('chat-simulator-send').click({
      force: true,
    });

    cy.findAllByTestId('agent-message-content', { timeout: 50000 })
      .its('length')
      .should('eq', 2, { timeout: 50000 });

    // wait for credit checker to run in the background
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(5000);

    cy.visit('/settings/organization/billing');

    cy.findByTestId('total-credits', {
      timeout: 50000,
    }).contains('64', { timeout: 50000 });
  });
});
