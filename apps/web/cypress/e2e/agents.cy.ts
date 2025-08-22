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
    cy.seedDefaultProject('CYDOGGTestProject');
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

  describe('Memory Block Management', () => {
    it(
      'should edit memory block content',
      { tags: ['@memory-blocks'] },
      () => {
        cy.testStep('Verify agent structure', () => {
          cy.findAllByTestId('accordion-trigger-core-tools', {
            timeout: 50000
          }).first().should('exist');
          cy.findByTestId('edit-memory-block-human-content', {
            timeout: 50000,
          }).should('exist');
        });

        cy.testStep('Edit memory block content', () => {
          cy.clearPointerEventLock();
          cy.waitForMemoryBlockReady();

          cy.findAllByTestId('edit-memory-block-human-content', {
            timeout: 50000,
          })
            .first()
            .dblclick({ force: true });

          cy.findAllByTestId('edit-memory-block-human-content', {
            timeout: 50000,
          })
            .first()
            .should('have.prop', 'tagName', 'TEXTAREA')
            .clear()
            .type(
              'This is updated memory block content. The user is a helpful assistant.',
              { parseSpecialCharSequences: false },
            );

          cy.findByTestId('edit-memory-block-human-content-save').click();
          cy.findByTestId('edit-memory-block-human-content-lock', {
            timeout: 5000,
          }).click();
        });

        cy.testStep('Verify memory content updated', () => {
          cy.findByTestId('edit-memory-block-human-content', {
            timeout: 50000,
          }).should('contain', 'This is updated memory block content');
        });
      },
    );

    it(
      'should create and delete a memory block through the advanced editor',
      { tags: ['@memory-blocks', '@advanced-editor'] },
      () => {
        cy.testStep('Open the Advanced Core Memory Editor', () => {
          cy.findByTestId('open-advanced-memory-editor', {
            timeout: 50000,
          }).click();
        });

        cy.testStep('Create a new memory block', () => {
          // Click the create new memory block button in the sidebar
          cy.findAllByTestId('create-new-memory-block-item', { timeout: 10000 })
            .first()
            .click();

          // Fill in the basic memory block details
          cy.findByTestId('memory-block-label-input').type(
            'cypress_test_block',
          );
          cy.findByTestId('memory-block-description-input').type(
            'A test memory block created by Cypress automation',
          );

          // Expand advanced section with predictable testId
          cy.findByTestId(
            'accordion-trigger-memory-block-advanced-options',
          ).click();

          // Set advanced field values
          cy.findByTestId('memory-block-value-input').type(
            'This is test content for the cypress memory block. It contains important information that will be used during testing.',
          );
          cy.findByTestId('memory-block-character-limit-input')
            .clear()
            .type('2000');


          // Submit the form using the dialog's confirm button
          cy.findByTestId('create-new-memory-block-dialog-confirm-button', {
            timeout: 5000,
          }).click();
        });

        cy.testStep('Verify memory block was created', () => {
          // Check that the new memory block appears in the sidebar
          cy.findByTestId('memory-block-cypress_test_block', {
            timeout: 50000,
          })
            .should('exist')
            .and('be.visible');

          // Click on the memory block to select it
          cy.findByTestId('memory-block-cypress_test_block').click();

          // Verify the content is displayed in the advanced editor
          cy.findByTestId('advanced-memory-editor-description', {
            timeout: 5000,
          }).should(
            'contain.value',
            'A test memory block created by Cypress automation',
          );

          cy.findByTestId('advanced-memory-editor-value').should(
            'contain.value',
            'This is test content for the cypress memory block',
          );
        });

        cy.testStep('Test readOnly functionality and modify block', () => {
          // Select the memory block
          cy.findByTestId('memory-block-cypress_test_block').click();

          // Enable readOnly checkbox to test this functionality
          cy.findByTestId('advanced-memory-editor-readonly-checkbox').click();

          // Update the memory block with readOnly enabled
          cy.findByTestId('advanced-memory-editor-update').click();

          // Wait for the update to complete
          cy.wait(2000);
        });

        cy.testStep('Delete the memory block', () => {
          // Now delete the memory block
          cy.findByTestId('memory-block-cypress_test_block').click();
          cy.findByTestId('delete-memory-block', { timeout: 5000 }).click();
          cy.findByTestId('delete-memory-block-dialog-confirm-button').click();
        });

        cy.testStep('Verify memory block was deleted from UI', () => {
          // Verify the memory block no longer exists in the sidebar
          cy.findByTestId('memory-block-cypress_test_block', {
            timeout: 5000,
          }).should('not.exist');
        });
      },
    );
  });
});
