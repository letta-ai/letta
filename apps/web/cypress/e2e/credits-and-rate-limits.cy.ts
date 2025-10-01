describe('credit usage', () => {
  before(() => {
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

  after(() => {
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

  it('should prevent a user from messaging due to low credits', () => {
    Cypress.config('defaultCommandTimeout', 50000);

    cy.visit('/');
    cy.location('pathname').should('eq', '/login');

    cy.googleLogin();

    cy.visit('/projects');

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

    cy.request({
      method: 'POST',
      url: '/aia/reset-credits',
      body: {
        nextCredits: 1,
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
        stepCost: 5,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    cy.findByTestId('chat-simulator-send').click({
      force: true,
    });

    cy.findByTestId('chat-simulator-error', { timeout: 50000 }).contains(
      'buy more credits',
    );
  });

  it.skip('should upgrade a user to pro plan', () => {
    Cypress.config('defaultCommandTimeout', 50000);

    cy.visit('/');
    cy.location('pathname').should('eq', '/login');

    cy.googleLogin();

    cy.visit('/settings/organization/usage');

    cy.findByTestId('upgrade-to-pro', {
      timeout: 50000,
    }).click();

    cy.findByTestId('choose-pro', {
      timeout: 50000,
    }).click();

    cy.findByTestId('confirm-purchase', {
      timeout: 50000,
    }).click();

    cy.findByTestId('subscription-details', { timeout: 5000 }).contains(
      'You are currently on the Letta Cloud Pro plan.',
    );
  });

  it('should deduct credits from a user', () => {
    Cypress.config('defaultCommandTimeout', 50000);

    cy.visit('/');
    cy.location('pathname').should('eq', '/login');

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

    cy.visit('/settings/organization/usage');

    cy.findByTestId('total-credits', {
      timeout: 50000,
    }).should('include.text', '0.16', { timeout: 50000 });

    // Navigate to projects list explicitly
    cy.visit('/projects');

    cy.get('h1').contains(/Projects/);

    // creates a project
    cy.findAllByTestId('create-project-button').first().click();

    cy.findByTestId('project-name-input').type('CYDOGGRATELIMIT');

    cy.findByTestId('create-project-dialog-confirm-button').click();

    cy.findAllByTestId('nav-button-project-agents', { timeout: 50000 }).first().click();

    // creates an agent
    cy.findAllByTestId('deploy-agent-dialog-start', { timeout: 50000 })
      .first()
      .click();

    cy.findByTestId('image-card:Customer support').click();

    cy.location('pathname', { timeout: 50000 }).should(
      'match',
      /\/projects\/(.+)\/agents\/(.+)/,
    );

    cy.findByTestId('chat-simulator-input', { timeout: 50000 }).type(
      'What is my name',
      {
        force: true,
      },
    );

    // bruh
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(1000);

    cy.findByTestId('chat-simulator-send').click({
      force: true,
    });

    cy.findAllByTestId('agent-message-content', { timeout: 50000 })
      .its('length')
      .should('eq', 1, { timeout: 500000 });

    // wait for credit checker to run in the background
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(5000);

    cy.visit('/settings/organization/usage');

    // tmp disable
    // cy.findByTestId('total-credits', {
    //   timeout: 50000,
    // }).should('not.include.text', '0.16', { timeout: 50000 });

    cy.findByTestId('agent-usage-value', {
      timeout: 50000,
    }).should('contain', '1');
  });

  it('should rate limit a user', () => {
    Cypress.config('defaultCommandTimeout', 50000);

    cy.visit('/');
    cy.location('pathname').should('eq', '/login');

    cy.googleLogin();

    // Navigate to projects list explicitly
    cy.visit('/projects');

    cy.get('h1').contains(/Projects/);

    // creates a project
    cy.findAllByTestId('create-project-button').first().click();

    cy.findByTestId('project-name-input').type('CYDOGGRATELIMIT');

    cy.findByTestId('create-project-dialog-confirm-button').click();

    cy.wait(2000);

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
      url: '/aia/reset-credits',
      body: {
        nextCredits: 1000,
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
        stepCost: 1,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

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

    // wait for messages to load
    cy.findAllByTestId('agent-message-content', { timeout: 50000 })
      .its('length')
      .should('eq', 1);

    cy.findByTestId('chat-simulator-input').type('What is my name', {
      force: true,
    });

    cy.findByTestId('chat-simulator-send').click({
      force: true,
    });

    cy.findByTestId('chat-simulator-error', { timeout: 50000 }).contains(
      'Rate limit reached, please wait a few moments before trying again.',
    );
  });
});
