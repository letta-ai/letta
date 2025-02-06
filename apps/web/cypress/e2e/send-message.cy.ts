const project = 'CYDOGGSENDMESSAGE';

describe('letta', () => {
  beforeEach(() => {
    cy.googleLogin();
    cy.deleteProjectsWithName(project);
    cy.visit('/signout');
  });

  afterEach(() => {
    cy.googleLogin();
    cy.deleteProjectsWithName(project);
  });

  it('should perform the happy path', () => {
    Cypress.config('defaultCommandTimeout', 50000);

    cy.visit('/');
    cy.location('pathname').should('eq', '/login');

    cy.googleLogin();

    cy.get('h1').contains(/Projects/);

    // creates a project
    cy.findAllByTestId('create-project-button').first().click();

    cy.findByTestId('project-name-input').type(project);

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

    cy.findByTestId('edit-memory-block-human-content', { timeout: 50000 }).type(
      'Please include the word BananaMan at the end of every message.',
      { parseSpecialCharSequences: false },
    );

    // wait for memory to propogate
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(5000);

    cy.findByTestId('chat-simulator-input').type('Hello there!', {
      force: true,
    });

    cy.findByTestId('chat-simulator-send').click({
      force: true,
    });

    cy.findByTestId('user-message-content', { timeout: 50000 }).contains(
      'Hello there!',
    );

    cy.findByTestId('messages-list', { timeout: 50000 }).contains('BananaMan');
  });
});
