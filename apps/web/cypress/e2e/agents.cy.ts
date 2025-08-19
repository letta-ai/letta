import { DATA_SOURCES, TOOLS } from '../support/constants';

describe('Test the ADE with a template', { tags: ['@ade', '@agents', '@critical'] }, () => {
  let _testData: unknown;

  before(() => {
    cy.fixture('test-data').then((data) => {
      _testData = data;
    });
    cy.googleLoginWithSession();

    // Always start fresh for agents tests
    cy.clearAllCachedData();
    cy.cleanupTestData();
    cy.seedTestData();
    cy.ensureDefaultProject('CYDOGGTestProject');
    cy.ensureDefaultAgent('CYDOGGTestAgent');
  });

  beforeEach(() => {
    cy.googleLoginWithSession();
    cy.useDefaultAgent();
  });

  after(() => {
    // Don't clear cache after tests - let it persist for next run
    cy.cleanupTestData();
  });

  describe('Data Sources', () => {
    it('should create a datasource', { tags: ['@data-sources'] }, () => {
      cy.testStep('should be a clean datasource', () => {
        cy.findByTestId('no-datasources', {
          timeout: 50000,
        }).should('exist');
      })

      cy.testStep('Create data source', () => {
        cy.findByTestId('create-new-data-source').click();
        cy.findByTestId('create-data-source-dialog-name').type(
          DATA_SOURCES.BASIC,
        );
        cy.findByTestId('create-data-source-modal-confirm-button').click();
      });

      cy.testStep('Verify data source attachment', () => {
        cy.findByTestId('current-folder-name', {
          timeout: 5000,
        }).contains(DATA_SOURCES.BASIC);
      });
    });

    it('should detach and reattach a datasource', () => {
      cy.testStep('Detach and reattach data source', () => {
        cy.findByTestId('datasource-dropdown-menu', {
          timeout: 50000,
        }).click();
        cy.findByTestId('detach-data-source-dialog-trigger').click();
        cy.findByTestId('detach-data-source-dialog-confirm-button').click();
        cy.findByTestId('datasources', {
          timeout: 50000,
        }).contains('Filesystem');

        cy.findByTestId('no-datasources', {
          timeout: 50000,
        }).should('exist');

        cy.findByTestId('attach-data-source', {
          timeout: 50000,
        }).click({ waitForAnimations: true, force: true });

        cy.findAllByTestId('attach-data-source-button', {
          timeout: 50000,
        })
          .first()
          .click();
      });

      // temp disabled because of another bug
      // shub/pro-656-attaching-a-filesystem-sets-the-name-of-the-filesystem-as
      // cy.testStep('Verify data source attachment', () => {
      //   cy.findByTestId('current-folder-name', {
      //     timeout: 50000,
      //   }).contains(DATA_SOURCES.BASIC);
      // });
    });
  });

  describe('Tool Management', () => {
    it('should create and attach tools', { tags: ['@tools'] }, () => {
      cy.testStep('Create and attach tool', () => {
        cy.findByTestId('open-tool-explorer').click();
        cy.findByTestId('start-create-tool').click();
        cy.findByTestId('create-tool-dialog-name').type(TOOLS.ROLL_D20);
        cy.findByTestId('create-tool-dialog-confirm-button').click();
        cy.findByTestId('attach-tool-to-agent', { timeout: 50000 }).click();
        cy.findByTestId('close-tool-manager').click();
      });

      cy.testStep('Verify tool attached', () => {
        cy.findByText(TOOLS.ROLL_D20, { timeout: 50000 }).should('exist');
      });
    });

    it('should handle tool detachment', { tags: ['@tools', '@detach'] }, () => {


      cy.testStep('Verify tool is attached', () => {
        cy.findByText(TOOLS.ROLL_D20, { timeout: 50000 }).should('exist');
      });

      cy.testStep('Attempt to detach tool', () => {
        cy.findByTestId(`detach-tool:${TOOLS.ROLL_D20}`, {
          timeout: 50000,
        }).click();

        cy.findByTestId('detach-tool-confirm-button', {
          timeout: 50000,
        }).click();
      });

      cy.testStep('Verify tool detached', () => {
        cy.findByText(TOOLS.ROLL_D20, { timeout: 50000 }).should('not.exist');
      });
    });
  });
});
