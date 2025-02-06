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
    Cypress.config('defaultCommandTimeout', 50000);

    cy.visit('/');
    cy.location('pathname').should('eq', '/login');

    cy.googleLogin();

    cy.get('h1').contains(/Projects/);

    // creates a project
    cy.findAllByTestId('create-project-button').first().click();

    cy.findByTestId('project-name-input').type('CYDOGGTestProject');

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

    cy.findByTestId('update-agent-name-button').click();

    cy.findByTestId('update-name-dialog-update-name').invoke('val', '');

    cy.findByTestId('update-name-dialog-update-name').type('CYDOGGTestAgent');

    cy.findByTestId('update-name-dialog-confirm-button').click();

    cy.location('pathname', { timeout: 50000 }).should(
      'match',
      /\/projects\/(.+)\/templates\/CYDOGGTestAgent/,
    );

    cy.clearPointerEventLock();

    cy.findByTestId('edit-memory-block-human-content', { timeout: 50000 }).type(
      'The users name is {{name}}. Please include the word BananaMan at the end of every message.',
      { parseSpecialCharSequences: false },
    );

    cy.findByTestId('toggle-variables-button', { timeout: 50000 })
      .first()
      .click();

    cy.findByTestId('key-value-editor-value-0').type('Shubham');
    cy.findByTestId('save-variables-button').click();

    cy.findByTestId('tab-item:simulated', { timeout: 50000 }).click();
    cy.findByTestId('simulated-memory:human', { timeout: 50000 }).should(
      'contain.value',
      'Shubham',
    );

    cy.findByTestId('tab:datasources').click();

    cy.findByTestId('create-data-source-dialog-trigger').click();
    cy.findByTestId('create-new-data-source').click();

    cy.findByTestId('tab:datasources').contains('Sources (1)');
    cy.findByTestId('filetree-actions:1-0').click();
    cy.findByTestId('filetree-action-detach').click();
    cy.findByTestId('detach-data-source-dialog-confirm-button').click();
    cy.findByTestId('tab:datasources', {
      timeout: 50000,
    }).contains('Sources (0)');

    cy.findByTestId('create-data-source-dialog-trigger', {
      timeout: 50000,
    }).click({ waitForAnimations: true, force: true });
    cy.findByTestId('attach-existing-data-source').click();

    cy.findAllByTestId('attach-data-source-button', {
      timeout: 50000,
    })
      .first()
      .click();

    cy.clearPointerEventLock();
    cy.get('body').click({ force: true });

    cy.clearPointerEventLock();
    cy.findByTestId('tab:tools').click({ force: true });

    /* tools */
    cy.findByTestId('open-tool-explorer').click();

    cy.findByTestId('start-create-tool').click();

    cy.findByTestId('submit-create-tool').click();

    cy.findByTestId('attach-tool-to-agent', { timeout: 50000 }).click();

    cy.findByTestId('close-tool-explorer').click();

    cy.findByText('roll_d20', { timeout: 50000 }).should('exist');

    cy.get('body').click({ force: true });

    cy.findAllByTestId('version-template-trigger')
      .first()
      .click({ force: true });

    cy.findByTestId('stage-new-version-button').click({ force: true });
    cy.findByTestId('stage-agent-dialog-confirm-button').click({ force: true });
    cy.findByTestId('deploy-agent-dialog-trigger', { timeout: 50000 }).click();

    cy.clearPointerEventLock();

    // deploy the agent
    cy.findByTestId('deploy-agent-instructions-code-editor').should('exist');

    cy.findByTestId('show-api-key-switch').click();

    // create an agent from the template
    cy.request({
      method: 'POST',
      url: '/v1/agents',
      body: {
        from_template: 'CYDOGGTestAgent:latest',
        name: 'deployedagent',
        tags: ['test'],
        memory_variables: {
          name: 'Shubham',
        },
        toolVariables: {},
      },
    }).then((response) => {
      expect(response.body.name).eq('deployedagent');
      expect(response.body.tags[0]).eq('test');
      const humanBlock = response.body.memory.blocks.find(
        (block) => block.label === 'human',
      );
      expect(humanBlock.value).to.contain('Shubham');
      expect(response.status).to.eq(201);
    });
  });
});
