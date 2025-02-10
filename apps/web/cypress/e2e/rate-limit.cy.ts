describe('letta', () => {
  beforeEach(() => {
    cy.googleLogin();
    cy.importModels();
    cy.grantAdminAccess();
    cy.request({
      method: 'POST',
      url: '/aia/rate-limit-models',
      body: {
        modelName: 'gpt-4o-mini',
        rpm: 1000,
        tpm: 1000,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    cy.deleteProjectsWithName('CYDOGGRATELIMIT');
    cy.visit('/signout');


  });

  afterEach(() => {


    cy.googleLogin();

    cy.request({
      method: 'POST',
      url: '/aia/rate-limit-models',
      body: {
        modelName: 'gpt-4o-mini',
        rpm: 1000,
        tpm: 1000,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    cy.deleteProjectsWithName('CYDOGGRATELIMIT');
  });

  it('should test rate limiting', () => {
    Cypress.config('defaultCommandTimeout', 50000);

    cy.visit('/');
    cy.location('pathname').should('eq', '/login');

    cy.googleLogin();


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

    cy.request({
      method: 'POST',
      url: '/aia/rate-limit-models',
      body: {
        modelName: 'gpt-4o-mini',
        rpm: 0,
        tpm: 0,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });


    cy.findByTestId('chat-simulator-input').type('What is my name', {
      force: true,
    });

    cy.findByTestId('chat-simulator-send').click({
      force: true,
    });

    cy.findByTestId('chat-simulator-error', { timeout: 50000 }).contains('Rate limit reached, please wait a few moments before trying again.');
  });
});
