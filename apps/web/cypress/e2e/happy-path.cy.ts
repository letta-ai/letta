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

    cy.request({
      method: 'POST',
      url: '/aia/reset-credits',
      body: {
        nextCredits: 100,
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

    cy.importModels();
    cy.visit('/projects');

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

    cy.findAllByTestId('edit-memory-block-human-content', { timeout: 500000 })
      .first()
      .dblclick({ force: true });

    cy.findAllByTestId('edit-memory-block-human-content', { timeout: 50000 })
      .first()
      .should('have.prop', 'tagName', 'TEXTAREA')
      .type(
        'The users name is {{name}}. Please include the word BananaMan at the end of every message.',
        { parseSpecialCharSequences: false },
      );

    cy.findByTestId('edit-memory-block-human-content-save').click();
    cy.findByTestId('edit-memory-block-human-content-lock', {
      timeout: 5000,
    }).click();

    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(5000);

    cy.findByTestId('toggle-variables-button', { timeout: 50000 })
      .first()
      .click();

    cy.findByTestId('key-value-editor-value-0', { timeout: 50000 }).type(
      'Shubham',
    );
    cy.findByTestId('save-variables-button').click();

    // wait for save (kinda...)
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(2000);

    cy.findByTestId('tab-item:agent', { timeout: 50000 }).click({
      force: true,
    });
    cy.findByTestId('edit-memory-block-human-content', {
      timeout: 50000,
    }).contains('Shubham', { timeout: 50000 });

    cy.findByTestId('create-new-data-source').click();
    cy.findByTestId('create-data-source-dialog-name').type('test');

    cy.findByTestId('create-data-source-modal-confirm-button').click();

    cy.findByTestId('datasources').contains('Filesystem');
    cy.findByTestId('datasource-dropdown-menu').click();
    cy.findByTestId('detach-data-source-dialog-trigger').click();
    cy.findByTestId('detach-data-source-dialog-confirm-button').click();
    cy.findByTestId('datasources', {
      timeout: 50000,
    }).contains('Filesystem');

    cy.findByTestId('attach-data-source', {
      timeout: 50000,
    }).click({ waitForAnimations: true, force: true });

    cy.findAllByTestId('attach-data-source-button', {
      timeout: 50000,
    })
      .first()
      .click();

    cy.clearPointerEventLock();
    cy.get('body').click({ force: true });

    cy.clearPointerEventLock();

    /* tools */
    cy.findByTestId('open-tool-explorer').click();

    cy.findByTestId('start-create-tool').click();

    cy.findByTestId('create-tool-dialog-name').type('roll_d20');

    cy.findByTestId('create-tool-dialog-confirm-button').click();

    cy.findByTestId('attach-tool-to-agent', { timeout: 50000 }).click();

    cy.findByTestId('close-tool-manager').click();

    cy.findByText('roll_d20', { timeout: 50000 }).should('exist');

    cy.get('body').click({ force: true });

    cy.findByTestId('stage-new-version-button').click({ force: true });
    cy.findByTestId('deploy-agent-dialog-trigger', { timeout: 50000 }).click();

    cy.clearPointerEventLock();

    cy.get('[data-testid="deploy-agent-dialog-trigger"]', {
      timeout: 50000,
    }).should('not.exist', { timeout: 50000 });

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
