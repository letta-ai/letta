describe('letta', () => {
  beforeEach(() => {
    cy.googleLogin();
    cy.deleteProjectsWithName('CYDOGGTestProject');
    cy.visit('/signout');
  });

  afterEach(() => {
    cy.googleLogin();
    cy.deleteProjectsWithName('CYDOGGTestProject');
  });

  it('should perform the happy path', () => {
    Cypress.config('defaultCommandTimeout', 10000);

    cy.visit('/');
    cy.location('pathname').should('eq', '/login');

    cy.googleLogin();

    cy.get('h1').contains(/Projects/);

    // creates a project
    cy.findByTestId('create-project-button').click();

    cy.findByTestId('project-name-input').type('CYDOGGTestProject');

    cy.findByTestId('create-project-dialog-confirm-button').click();

    // creates an agent
    cy.findByTestId('create-agent-template-button', { timeout: 10000 }).click();

    cy.location('pathname').should('match', /\/projects\/(.+)\/templates\/new/);

    cy.findByTestId('pre-existing-template-dropdown-trigger', {
      timeout: 10000,
    }).click({ force: true });

    cy.findByText('Customer Support').click();

    cy.findByTestId('agent-name-input').type('CYDOGGTestAgent');

    cy.findByTestId('create-agent-button').click();

    cy.location('pathname').should(
      'match',
      /\/projects\/(.+)\/templates\/(.+)/
    );

    cy.findByTestId('tab:edit-core-memories').click();

    cy.findByTestId('edit-memory-block:human').click();

    cy.findByTestId('edit-memory-block-content').type(
      'Please include the word BananaMan at the end of every message.'
    );

    cy.findByTestId('toggle-variables-button').click();

    cy.findByTestId('variable-input-name').type('Shubham');

    cy.findByTestId('create-data-source-dialog-trigger').click();
    cy.findByTestId('create-new-data-source').click();

    cy.findByTestId('tab:edit-data-sources').contains('Sources (1)');
    cy.findByTestId('filetree-actions:1-0').click();
    cy.findByTestId('filetree-action-detach').click();
    cy.findByTestId('detach-data-source-dialog-confirm-button').click();
    cy.findByTestId('tab:edit-data-sources', {
      timeout: 10000,
    }).contains('Sources (-)');

    cy.findByTestId('create-data-source-dialog-trigger', {
      timeout: 10000,
    }).click({ waitForAnimations: true, force: true });
    cy.findByTestId('attach-existing-data-source').click();

    cy.findAllByTestId('attach-data-source-button').first().click();

    cy.findByTestId('chat-simulator-input').type('What is my name', {
      force: true,
    });
    cy.findByTestId('chat-simulator-send').click({
      force: true,
    });

    cy.findByTestId('messages-list').contains('Shubham', { timeout: 10000 });
    cy.findByTestId('messages-list').contains('BananaMan', { timeout: 10000 });

    cy.findByTestId('version-template-trigger').click({ force: true });

    cy.findByTestId('stage-new-version-button').click({ force: true });
    cy.findByTestId('stage-agent-dialog-confirm-button').click({ force: true });
    cy.findByTestId('deploy-agent-dialog-trigger', { timeout: 10000 }).click({
      force: true,
    });

    // deploy the agent
    cy.findByTestId('deploy-agent-instructions-code-editor').should('exist');

    cy.findByTestId('show-api-key-switch').click();
    //
    // Get text
    // cy.get('[data-testid="deploy-agent-instructions-raw-code"]')
    //   .invoke('text')
    //   .then((text) => {
    //     cy.exec(text);
    //   });

    // cy.get('[data-testid="chat-with-agent-instructions-raw-code"]', {
    //   timeout: 10000,
    // }).should('exist');
    //
    // cy.get('[data-testid="chat-with-agent-instructions-raw-code"]', {
    //   timeout: 10000,
    // })
    //   .invoke('text')
    //   .then((text) => {
    //     const textToSubmit = text
    //       .replace('Hello', 'Can you tell me my name?')
    //       .replace(/true/g, 'false')
    //       .replace('-N', '');
    //
    //     cy.exec(textToSubmit, { timeout: 10000 }).then((result) => {
    //       expect(result.stdout).to.contain('BananaMan');
    //     });
    //   });

    // stage the agent

    // cy.findByTestId('tab:Template Version Manager').click();
    //
    //
    //
    // cy.findByTestId('stage-agent-dialog-confirm-button').click();

    // cy.findByTestId('show-deployment-instructions-0', {
    //   timeout: 10000,
    // }).click();
    //
    // deploy the agent
    // cy.findByTestId('deploy-agent-instructions-code-editor').should('exist');
    //
    // cy.findByTestId('show-api-key-switch').click();
    // //
    // // Get text
    // cy.get('[data-testid="deploy-agent-instructions-raw-code"]')
    //   .invoke('text')
    //   .then((text) => {
    //     cy.exec(text);
    //   });
    //
    // cy.get('[data-testid="chat-with-agent-instructions-raw-code"]', {
    //   timeout: 10000,
    // }).should('exist');

    // cy.get('[data-testid="chat-with-agent-instructions-raw-code"]', {
    //   timeout: 10000,
    // })
    //   .invoke('text')
    //   .then((text) => {
    //     const textToSubmit = text
    //       .replace('Hello', 'Can you tell me my name?')
    //       .replace(/true/g, 'false')
    //       .replace('-N', '');
    //
    //     cy.exec(textToSubmit, { timeout: 10000 }).then((result) => {
    //       expect(result.stdout).to.contain('BananaMan');
    //     });
    //   });
  });
});
