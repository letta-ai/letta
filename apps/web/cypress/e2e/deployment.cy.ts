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
    cy.createProject('DEPLOYMENTEST');

    // create an identity
    cy.visit('/projects/deploymentest/identities');
    cy.createIdentity('DEPLOYMENTIDENTITY', 'DEPLOYMENTIDENTITY');

    // go to agent creation
    cy.visit('/projects/deploymentest');

    // creates an agent
    cy.createAgentTemplate('Customer support', 'DEPLOYMENTAGENT');

    cy.clearPointerEventLock();

    cy.findByTestId('toggle-variables-button', { timeout: 50000 })
      .first()
      .click();
    // Wait for the tab to be visible and clickable
    cy.findByTestId('tab-item:environment', { timeout: 10000 })
      .should('be.visible')
      .click();

    cy.findByTestId('add-variable-button').click();
    cy.findByTestId('key-value-editor-key-0').type('tool_variable');
    cy.findByTestId('save-variables-button').click();

    cy.location('pathname', { timeout: 50000 }).should(
      'match',
      /\/projects\/(.+)\/templates\/DEPLOYMENTAGENT/,
    );

    cy.clearPointerEventLock();
    cy.wait(3000);
    cy.editMemoryBlock(
      'The users name is {{name}}. Please include the word DeploymentMan at the end of every message.',
    );


    cy.stageAndDeployAgent();


    cy.location('pathname', { timeout: 50000 }).should(
      'match',
      /\/projects\/(.+)\/templates\/DEPLOYMENTAGENT\/distribution/,
      { timeout: 50000 }
    );

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

    cy.findAllByTestId('fullversion:DEPLOYMENTAGENT:2', { timeout: 50000 })
      .first()
      .should('exist');

    cy.findByTestId('edit-memory-block-human-content', {
      timeout: 50000,
    }).contains('DeploymentMan');

    cy.findByTestId('edit-memory-block-human-content', {
      timeout: 50000,
    }).contains('Charles');

    // add identity
    // First open the Metadata accordion panel
    cy.findByTestId('ade-tab-header:settings').click();
    cy.findByTestId('accordion-trigger:metadata').click();

    cy.findByTestId('update-identities').click();

    cy.findByTestId('select-text-area-identities-selector', {
      timeout: 10000,
    }).type('DEPLOYMENTIDENTITY');

    cy.findByText('DEPLOYMENTIDENTITY (DEPLOYMENTIDENTITY)').click();

    cy.findByTestId('update-identities-dialog-confirm-button').click();

    cy.findByTestId('identity-viewer-input', { timeout: 50000 }).should(
      'have.value',
      'DEPLOYMENTIDENTITY',
      { timeout: 50000 },
    );

    cy.findAllByTestId('fullversion:DEPLOYMENTAGENT:2')
      .first()
      .click({ force: true });

    cy.location('pathname', { timeout: 50000 }).should(
      'match',
      /\/projects\/(.+)\/templates\/DEPLOYMENTAGENT/,
    );

    cy.editMemoryBlock(
      'Extemely important, please also include WowCheese at the end of your response.',
    );

    cy.stageAndDeployAgent();

    cy.location('pathname', { timeout: 50000 }).should(
      'match',
      /\/projects\/(.+)\/templates\/DEPLOYMENTAGENT\/distribution/,
      { timeout: 50000 }
    );

    cy.visit('/projects/deploymentest/agents');

    cy.get('h1').contains(/Agents/);

    cy.findByTestId('open-in-ade', { timeout: 5000 }).click();

    cy.location('pathname', { timeout: 50000 }).should(
      'match',
      /\/projects\/(.+)\/agents\/(.+)/,
    );

    cy.findByTestId('edit-memory-block-human-content', {
      timeout: 50000,
    }).contains('WowCheese');

    cy.findAllByTestId('fullversion:DEPLOYMENTAGENT:3').first().should('exist');

    // Open Metadata accordion to access identity viewer
    cy.findByTestId('ade-tab-header:settings').click();
    cy.findByTestId('accordion-trigger:metadata').click();

    cy.findByTestId('identity-viewer-input', { timeout: 50000 }).should(
      'have.value',
      'DEPLOYMENTIDENTITY',
      { timeout: 50000 },
    );
  });
});
