describe('letta', () => {
  beforeEach(() => {
    cy.googleLogin();
    cy.deleteProjectsWithName('DEPLOYMENTEST');
    cy.visit('/signout');
  });

  afterEach(() => {
    cy.googleLogin();
    cy.deleteProjectsWithName('DEPLOYMENTEST');
  });

  it('deploy agents', () => {
    Cypress.config('defaultCommandTimeout', 50000);
    cy.googleLogin();
    cy.importModels();

    cy.visit('/projects');

    cy.get('h1', { timeout: 5000 }).contains(/Projects/);

    // creates a project
    cy.findAllByTestId('create-project-button').first().click();

    cy.findByTestId('project-name-input').type('DEPLOYMENTEST');

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

    cy.findByTestId('update-name-dialog-update-name').type('DEPLOYMENTAGENT');

    cy.findByTestId('update-name-dialog-confirm-button').click();

    cy.location('pathname', { timeout: 50000 }).should(
      'match',
      /\/projects\/(.+)\/templates\/DEPLOYMENTAGENT/,
    );

    cy.clearPointerEventLock();

    cy.findByTestId('toggle-variables-button', { timeout: 50000 })
      .first()
      .click();
    cy.findByTestId('tab-item:environment').click();

    cy.findByTestId('add-variable-button').click();
    cy.findByTestId('key-value-editor-key-0').type('tool_variable');
    cy.findByTestId('save-variables-button').click();

    cy.location('pathname', { timeout: 50000 }).should(
      'match',
      /\/projects\/(.+)\/templates\/DEPLOYMENTAGENT/,
    );

    cy.clearPointerEventLock();

    cy.findByTestId('edit-memory-block-human-content', { timeout: 50000 }).type(
      'The users name is {{name}}. Please include the word DeploymentMan at the end of every message.',
      { parseSpecialCharSequences: false },
    );

    // wait for the variables to be saved
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(2000);

    cy.clearPointerEventLock();

    cy.findAllByTestId('version-template-trigger')
      .first()
      .click({ force: true });

    cy.findByTestId('stage-new-version-button').click({ force: true });
    cy.findByTestId('stage-agent-dialog-confirm-button').click({ force: true });
    cy.findByTestId('deploy-agent-dialog-trigger', { timeout: 50000 }).click();

    cy.visit('/projects/deploymentest/agents');

    cy.get('h1').contains(/Agents/);
    cy.findAllByTestId('deploy-agent-dialog-start').first().click();

    cy.findByTestId('deploy-from-template-card:0', { timeout: 5000 }).click();

    cy.findByText('Memory Variables', { timeout: 50000 }).should('exist');

    cy.findAllByTestId('key-value-editor-value-0').first().type('Charles');

    cy.findByTestId('complete-create-agent-button').click();

    cy.location('pathname', { timeout: 50000 }).should(
      'match',
      /\/projects\/(.+)\/agents\/(.+)/,
    );

    cy.findAllByTestId('breadcrumb-item:DEPLOYMENTAGENT:2', { timeout: 50000 })
      .first()
      .should('exist');

    cy.findByTestId('edit-memory-block-human-content', { timeout: 50000 })
      .invoke('val')
      .then((val) => {
        expect(val).to.contain('DeploymentMan');
        expect(val).to.contain('Charles');
      });

    cy.findAllByTestId('breadcrumb-item:DEPLOYMENTAGENT:2').first().click();

    cy.location('pathname', { timeout: 50000 }).should(
      'match',
      /\/projects\/(.+)\/templates\/DEPLOYMENTAGENT/,
    );

    cy.findByTestId('edit-memory-block-human-content', { timeout: 50000 }).type(
      'Extemely important, please also include WowCheese at the end of your response.',
      { parseSpecialCharSequences: false },
    );

    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(2000);

    cy.clearPointerEventLock();

    cy.findAllByTestId('version-template-trigger')
      .first()
      .click({ force: true });

    cy.findByTestId('stage-new-version-button').click({ force: true });
    cy.findByTestId('stage-agent-dialog-confirm-button').click({ force: true });
    cy.findByTestId('deploy-agent-dialog-trigger', { timeout: 50000 }).click();

    cy.visit('/projects/deploymentest/agents');

    cy.get('h1').contains(/Agents/);

    cy.findByTestId('open-in-ade', { timeout: 5000 }).click();

    cy.location('pathname', { timeout: 50000 }).should(
      'match',
      /\/projects\/(.+)\/agents\/(.+)/,
    );

    cy.findByTestId('edit-memory-block-human-content', { timeout: 50000 })
      .invoke('val')
      .then((val) => {
        expect(val).to.contain('WowCheese');
      });

    cy.findAllByTestId('breadcrumb-item:DEPLOYMENTAGENT:3')
      .first()
      .should('exist');
  });
});
