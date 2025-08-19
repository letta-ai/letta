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
            cy.findByTestId('create-data-source-dialog-name').type(DATA_SOURCES.TEMPLATE);
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
