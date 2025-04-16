describe('letta', () => {
  beforeEach(() => {
    cy.googleLogin();
    cy.deleteProjectsWithName('CYDOGGMemoryCRUDProject');
    cy.visit('/signout');
  });

  afterEach(() => {
    cy.googleLogin();
    cy.deleteProjectsWithName('CYDOGGMemoryCRUDProject');
  });

  it('should be able to add and delete a memory block from an agent', () => {
    Cypress.config('defaultCommandTimeout', 50000);

    cy.visit('/');
    cy.location('pathname').should('eq', '/login');

    cy.googleLogin();

    cy.get('h1').contains(/Projects/);

    // creates a project
    cy.findAllByTestId('create-project-button').first().click();

    cy.findByTestId('project-name-input').type('CYDOGGMemoryCRUDProject');

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

    cy.findByTestId('lock-memory', { timeout: 50000 }).then(($el) => {
      if ($el.attr('data-active') === 'true') {
        cy.findByTestId('lock-memory').click();
      }
    });
    cy.findByTestId('expand-edit-memory-block-human-content').click();

    cy.findByTestId('create-new-memory-block-item', {
      timeout: 5000,
    }).click({ force: true });

    cy.findByTestId('create-new-memory-block-label-input').type('test_block', {
      force: true,
    });

    cy.findByTestId('create-new-memory-block-dialog-confirm-button').click({
      force: true,
    });

    cy.findByTestId('memory-block-test_block', { timeout: 50000 }).should(
      'exist',
    );

    cy.findByTestId('advanced-memory-editor-value').type('test value', {
      force: true,
    });

    cy.findByTestId('advanced-memory-editor-update').click({ force: true });

    cy.findByTestId('close-advanced-core-memory-editor').click({ force: true });

    cy.findByTestId('edit-memory-block-test_block-content', {
      timeout: 50000,
    }).should('have.text', 'test value', { timeout: 50000 });

    cy.findByTestId('expand-edit-memory-block-test_block-content').click({
      force: true,
    });

    cy.findByTestId('delete-memory-block').click({ force: true });
    cy.findByTestId('delete-memory-block-dialog-confirm-button').click({
      force: true,
    });

    cy.findByTestId('memory-block-test_block', { timeout: 50000 }).should(
      'not.exist',
    );
  });
});
