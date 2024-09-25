describe('letta', () => {
  beforeEach(() => {
    cy.deleteProjectsWithName('CYDOGGTestProject');
    cy.visit('/signout');
  });

  afterEach(() => {
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

    cy.location('pathname').should('match', /\/projects\/(.+)\/agents\/new/);

    cy.findByTestId('agent-recipe-card-customer_support').click();

    cy.location('pathname').should('match', /\/projects\/(.+)\/agents\/(.+)/);

    // update core memory
    cy.findByTestId('ade-navigate-to:Memory Blocks').click();

    cy.findByTestId('edit-memory-block-0').click();

    cy.findByTestId('edit-memory-block-content').type(
      'They also want to be referred to as BananaMan, make sure to always call them that in every response.'
    );

    cy.findByTestId('edit-memory-block-save').click();

    // close the panel
    cy.findByTestId('ade-navigate-to:Memory Blocks').click();

    // simulate a conversation
    cy.findByTestId('ade-navigate-to:Chat Simulator').click();

    cy.findByTestId('chat-simulator-input').type('What is my name');

    cy.findByTestId('chat-simulator-send').click();

    cy.findByTestId('messages-list').contains('BananaMan');

    // stage the agent
    cy.findByTestId('open-deployment-manager').click();

    cy.findByTestId('stage-new-version-button').click();

    cy.findByTestId('stage-agent-dialog-confirm-button').click();

    cy.findByTestId('show-deployment-instructions-0', {
      timeout: 10000,
    }).click();

    // deploy the agent
    cy.findByTestId('deploy-agent-instructions-code-editor').should('exist');

    cy.findByTestId('show-api-key-switch').click();

    // Get text
    cy.findByTestId('deploy-agent-instructions-raw-code')
      .invoke('text')
      .then((text) => {
        cy.exec(text);
      });

    cy.findByTestId('chat-with-agent-instructions-raw-code', {
      timeout: 10000,
    }).should('exist');

    cy.findByTestId('chat-with-agent-instructions-raw-code')
      .invoke('text')
      .then((text) => {
        const textToSubmit = text
          .replace('Hello', 'Can you tell me my name?')
          .replace('true', 'false')
          .replace('-N', '');

        cy.exec(textToSubmit, { timeout: 10000 }).then((result) => {
          expect(result.stdout).to.contain('BananaMan');
        });
      });
  });
});
