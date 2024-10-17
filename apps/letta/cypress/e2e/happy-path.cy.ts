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

    cy.findByTestId('tab:Memory').click();

    cy.findByTestId('edit-memory-block:human').click();

    cy.findByTestId('edit-memory-block-content').type(
      'They also want to be referred to as BananaMan, make sure to always call them that in every response.'
    );

    // cy.findByTestId('chat-simulator-input').type('What is my name');
    //
    // cy.findByTestId('chat-simulator-send').click();
    //
    // cy.findByTestId('messages-list').contains('BananaMan', { timeout: 10000 });

    // stage the agent

    cy.findByTestId('tab:Template Version Manager').click();

    cy.findByTestId('stage-new-version-button').click();

    cy.findByTestId('stage-agent-dialog-confirm-button').click();

    // cy.findByTestId('show-deployment-instructions-0', {
    //   timeout: 10000,
    // }).click();
    //
    // // deploy the agent
    // cy.findByTestId('deploy-agent-instructions-code-editor').should('exist');
    //
    // cy.findByTestId('show-api-key-switch').click();
    //
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
