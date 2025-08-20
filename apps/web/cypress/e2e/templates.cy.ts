import { DATA_SOURCES, TOOLS } from '../support/constants';

describe(
  'Test the ADE with a template',
  { tags: ['@ade', '@agent-templates', '@critical'] },
  () => {
    let _testData: unknown;

    before(() => {
      cy.fixture('test-data').then((data) => {
        _testData = data;
      });
    });

    before(() => {
      cy.googleLoginWithSession();
      cy.clearAllCachedData();
      cy.cleanupTestData();
      cy.seedTestData();
      cy.ensureDefaultProject('CYDOGGTestProject');
      cy.ensureDefaultAgentTemplate('Customer support', 'CYDOGGTestAgent');
    });

    after(() => {
      // Don't clear cache after tests - let it persist for next run
      cy.cleanupTestData();
    });

    beforeEach(() => {
      cy.googleLoginWithSession();
      cy.useDefaultAgentTemplate();
    });

    describe('Default Template State', () => {
      it('should have attached the correct tools', () => {
        cy.testStep('Open core tools accordion', () => {
          cy.findAllByTestId('accordion-trigger-core-tools', {
            timeout: 50000,
          })
            .first()
            .click({
              force: true,
            });
        });

        cy.testStep('Verify core tools are attached', () => {
          cy.findByTestId('tool-attached:send_message')
            .should('exist')
            .and('be.visible');
          cy.findByTestId('tool-attached:conversation_search')
            .should('exist')
            .and('be.visible');
          cy.findByTestId('tool-attached:memory_insert')
            .should('exist')
            .and('be.visible');
          cy.findByTestId('tool-attached:memory_replace')
            .should('exist')
            .and('be.visible');
        });
      });
    });

    describe('Memory Block Configuration', () => {
      it(
        'should configure memory variables',
        { tags: ['@memory-variables'] },
        () => {
          cy.testStep('Edit memory block with variables', () => {
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
              .type(
                'The users name is {{name}}. Please include the word BananaMan at the end of every message.',
                { parseSpecialCharSequences: false },
              );

            cy.findByTestId('edit-memory-block-human-content-save').click();
            cy.findByTestId('edit-memory-block-human-content-lock', {
              timeout: 5000,
            }).click();
          });

          cy.testStep('Set memory variables', () => {
            cy.findByTestId('toggle-variables-button', { timeout: 50000 })
              .first()
              .click();

            cy.findByTestId('key-value-editor-value-0', {
              timeout: 50000,
            }).type('Shubham');
            cy.findByTestId('save-variables-button').click();
          });

          cy.testStep('Verify memory content updated', () => {
            cy.findByTestId('tab-item:agent', { timeout: 50000 }).click({
              force: true,
            });
            cy.findByTestId('edit-memory-block-human-content', {
              timeout: 50000,
            }).contains('Shubham', { timeout: 50000 });
          });
        },
      );
    });

    describe('Memory Block Management in Advanced Editor', () => {
      it(
        'should create and delete a memory block through the advanced editor',
        { tags: ['@memory-blocks', '@advanced-editor'] },
        () => {
          cy.testStep('Open the Advanced Core Memory Editor', () => {
            cy.findByTestId('open-advanced-memory-editor', {
              timeout: 10000,
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
              timeout: 10000,
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

          cy.testStep('Delete the memory block', () => {
            // Ensure the memory block is still selected
            cy.findByTestId('memory-block-cypress_test_block').should(
              'have.attr',
              'aria-selected',
              'true',
            );

            // Click the delete button
            cy.findByTestId('delete-memory-block', { timeout: 5000 }).click();

            // Confirm the deletion in the dialog
            cy.findByTestId(
              'delete-memory-block-dialog-confirm-button',
            ).click();
          });

          cy.testStep('Verify memory block was deleted', () => {
            // Verify the memory block no longer exists in the sidebar
            cy.findByTestId('memory-block-cypress_test_block', {
              timeout: 5000,
            }).should('not.exist');
          });
        },
      );
    });

    describe('Environment Variables', () => {
      it(
        'should manage environment variables',
        { tags: ['@environment-variables'] },
        () => {
          cy.testStep('Add environment variable', () => {
            cy.clearPointerEventLock();

            cy.findByTestId('toggle-variables-button', { timeout: 50000 })
              .first()
              .click();
            cy.findByTestId('tab-item:environment').click();

            cy.findByTestId('add-variable-button').click();
            cy.findByTestId('key-value-editor-key-0').type('tool_variable');
            cy.findByTestId('save-variables-button').click();
          });
        },
      );
    });

    describe('Template Deployment', () => {
      it(
        'should stage and deploy agent template',
        { tags: ['@deployment'] },
        () => {
          cy.testStep('Configure agent with all components', () => {
            cy.findByTestId('create-new-data-source').click();
            cy.findByTestId('create-data-source-dialog-name').type(
              DATA_SOURCES.TEMPLATE,
            );
            cy.findByTestId('create-data-source-modal-confirm-button').click();

            cy.findByTestId('open-tool-explorer').click();
            cy.findByTestId('start-create-tool').click();
            cy.findByTestId('create-tool-dialog-name').type(TOOLS.FOR_TEMPLATE);
            cy.findByTestId('create-tool-dialog-confirm-button').click();
            cy.findByTestId('attach-tool-to-agent', { timeout: 50000 }).click();
            cy.findByTestId('close-tool-manager').click();
          });

          cy.testStep('Stage and deploy agent', () => {
            cy.get('body').click({ force: true });
            cy.stageAndDeployAgent();
          });

          cy.testStep('Verify deployment via API', () => {
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
        },
      );
    });
  },
);
