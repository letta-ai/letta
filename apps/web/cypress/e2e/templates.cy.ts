import { DATA_SOURCES, TOOLS } from '../support/constants';
import type { AgentState } from '@letta-cloud/sdk-core';

describe(
  'Template Creation and Management',
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
      cy.seedDefaultProject('CYDOGGTestProject');
      cy.seedDefaultAgentTemplate('Customer support', 'CYDOGGTestAgent');
    });

    after(() => {
      // Don't clear cache after tests - let it persist for next run
      cy.cleanupTestData();
    });

    describe('Template Creation', () => {
      it(
        'should create a new agent template via UI',
        { tags: ['@template-creation'] },
        () => {
          cy.googleLoginWithSession();
          cy.task('getProjectSlug', 'CYDOGGTestProject').then((projectSlug) => {
            cy.visitWithDevDelay(`/projects/${projectSlug}`);
          });

          cy.testStep('Create agent template', () => {
            cy.findAllByTestId('create-agent-template-button', {
              timeout: 50000,
            })
              .first()
              .click();

            cy.findByTestId('image-card:Customer support').click();

            cy.location('pathname', { timeout: 50000 }).should(
              'match',
              /\/projects\/(.+)\/templates\/(.+)/,
            );
          });

          cy.testStep('Update template name', () => {
            cy.findByTestId('accordion-trigger:template-settings', {
              timeout: 50000,
            }).click();

            cy.findByTestId('update-template-name-button', {
              timeout: 50000
            }).click();
            cy.findByTestId('update-template-name-dialog-update-name').invoke('val', '');
            cy.findByTestId('update-template-name-dialog-update-name').type('NewTestTemplate');
            cy.findByTestId('update-template-name-dialog-confirm-button').click();

            cy.location('pathname', { timeout: 50000 }).should(
              'match',
              new RegExp('/projects/(.+)/templates/NewTestTemplate'),
            );
          });

          cy.testStep('Verify template structure', () => {
            cy.findByTestId('edit-memory-block-human-content', {
              timeout: 50000,
            }).should('exist');
          });
        },
      );
    });

    describe('Template Editing', () => {
      beforeEach(() => {
        cy.googleLoginWithSession();
        cy.useDefaultAgentTemplate();
      });

      it('should have attached the correct tools by default', () => {


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

      it(
        'should configure memory variables',
        { tags: ['@memory-variables'] },
        () => {
          let initialAgent: AgentState;
          let templateInfo: { projectSlug: string; templateName: string; templateVersion: string; fullTemplateVersion: string };

          cy.testStep('Get initial agent state from template', () => {
            cy.getCurrentTemplateFromUrl().then((template) => {
              templateInfo = template;
              return cy.createEntitiesFromTemplate({
                templateVersion: template.fullTemplateVersion,
                agentName: 'InitialTestAgent',
                tags: ['initial-test']
              });
            }).then((response) => {
              expect(response.agents).to.be.an('array');
              expect(response.agents[0]).to.have.property('id');

              initialAgent = response.agents[0];
              expect(initialAgent.name).to.eq('InitialTestAgent');

              // Verify initial state doesn't contain Shubham yet
              const humanBlock = initialAgent.memory.blocks.find(
                (block) => block.label === 'human'
              );
              expect(humanBlock, 'Human block should exist').to.exist;
              if (humanBlock) {
                expect(humanBlock.value).to.not.contain('Shubham');
              }
            });
          });

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

          cy.testStep('Save template version with migration enabled', () => {
            cy.get('body').click({ force: true });
            cy.stageAndDeployAgent();
          });

          cy.testStep('Verify initial agent was migrated to new values', () => {
            // Retrieve the updated initial agent using the API
            cy.request(`/v1/agents/${initialAgent.id}`)
              .its('body')
              .then((updatedAgent: AgentState) => {
                expect(updatedAgent.memory.blocks).to.be.an('array');

                const humanBlock = updatedAgent.memory.blocks.find(
                  (block) => block.label === 'human'
                );
                expect(humanBlock, 'Human block should exist after migration').to.exist;

                if (humanBlock) {
                  expect(humanBlock.value, 'Since we never defined this environment variable the agent should not contain this variable').to.not.contain('Shubham');
                  expect(humanBlock.value).to.contain('BananaMan');
                }
              });
          });

          cy.testStep('Create new agent and verify it gets updated template values', () => {
            cy.createEntitiesFromTemplate({
              templateVersion: `${templateInfo.templateVersion.replace(':current', ':latest')}`,
              agentName: 'NewTestAgent',
              tags: ['new-test'],
              memoryVariables: { name: 'Shubham' }
            }).then((response) => {
              expect(response.agents).to.be.an('array');

              const newAgent = response.agents[0];
              expect(newAgent.memory.blocks).to.be.an('array');
              expect(newAgent.name).to.eq('NewTestAgent');

              const humanBlock = newAgent.memory.blocks.find(
                (block) => block.label === 'human'
              );
              expect(humanBlock, 'Human block should exist in new agent').to.exist;

              if (humanBlock) {
                expect(humanBlock.value).to.contain('Shubham');
                expect(humanBlock.value).to.contain('BananaMan');
              }
            });
          });
        },
      );

      it('should allow users to update llm config properties', () => {
        let initialAgent: AgentState;
        let templateInfo: { projectSlug: string; templateName: string; templateVersion: string; fullTemplateVersion: string };

        // PHASE 1: Initial state verification
        cy.testStep('Phase 1: Create initial agent from current template state', () => {
          cy.getCurrentTemplateFromUrl().then((template) => {
            templateInfo = template;
            return cy.createEntitiesFromTemplate({
              templateVersion: template.fullTemplateVersion,
              agentName: 'AdvancedEditorTestAgent',
              tags: ['advanced-editor-test']
            });
          }).then((response) => {
            expect(response.agents).to.be.an('array');
            expect(response.agents[0]).to.have.property('id');

            initialAgent = response.agents[0];
            expect(initialAgent.name).to.eq('AdvancedEditorTestAgent');

            // Verify initial state has default llm_config
            expect(initialAgent.llm_config.temperature).to.eq(0.7);
            expect(initialAgent.llm_config.max_tokens).to.be.null;
            expect(initialAgent.llm_config.context_window).to.eq(128000);
          });
        });

        cy.testStep('Phase 1: Update llm_config properties in template editor', () => {
          // Open LLM configuration panel
          cy.findByTestId('accordion-trigger:llm-config', {
            timeout: 50000,
          }).click();

          // Update properties
          cy.findByTestId('slider-input:context-window-slider').clear().type('16000').blur();
          cy.findByTestId('slider-input:temperature-slider').clear().type('0.3').blur();

          // Enable max tokens first (since it's null by default)
          cy.findByTestId('switch:enable-max-tokens').click();
          cy.findByTestId('slider-input:max-tokens-slider').clear().type('2000').blur();

          // should automatically update (but theres some lag)
          cy.wait(2000);

        });

        cy.testStep('Phase 2: Save template version with migration enabled', () => {
          cy.get('body').click({ force: true });
          cy.stageAndDeployAgent();
        });

        cy.testStep('Phase 2: Verify initial agent was migrated to new llm_config values', () => {
          // Retrieve the updated initial agent using the API
          cy.request(`/v1/agents/${initialAgent.id}`)
            .its('body')
            .then((updatedAgent: AgentState) => {
              expect(updatedAgent.llm_config).to.be.an('object');
              expect(updatedAgent.llm_config.temperature).to.eq(0.3);
              expect(updatedAgent.llm_config.max_tokens).to.eq(2000);
              expect(updatedAgent.llm_config.context_window).to.eq(16000);
            });
        });

        cy.testStep('Phase 2: Create new agent and verify it gets updated llm_config values', () => {
          cy.createEntitiesFromTemplate({
            templateVersion: `${templateInfo.templateVersion.replace(':current', ':latest')}`,
            agentName: 'NewAgentWithUpdatedLLMConfig',
            tags: ['new-test-with-updated-llm']
          }).then((response) => {
            expect(response.agents).to.be.an('array');

            const newAgent = response.agents[0];
            expect(newAgent.llm_config).to.be.an('object');
            expect(newAgent.name).to.eq('NewAgentWithUpdatedLLMConfig');
            expect(newAgent.llm_config.temperature).to.eq(0.3);
            expect(newAgent.llm_config.max_tokens).to.eq(2000);
            expect(newAgent.llm_config.context_window).to.eq(16000);
          });
        });
      })

      it(
        'should create and delete a memory block through the advanced editor with migration verification',
        { tags: ['@memory-blocks', '@advanced-editor', '@migration'] },
        () => {
          let initialAgent: AgentState;
          let templateInfo: { projectSlug: string; templateName: string; templateVersion: string; fullTemplateVersion: string };

          // PHASE 1: Initial state verification
          cy.testStep('Phase 1: Create initial agent from current template state', () => {
            cy.getCurrentTemplateFromUrl().then((template) => {
              templateInfo = template;
              return cy.createEntitiesFromTemplate({
                templateVersion: template.fullTemplateVersion,
                agentName: 'AdvancedEditorTestAgent',
                tags: ['advanced-editor-test']
              });
            }).then((response) => {
              expect(response.agents).to.be.an('array');
              expect(response.agents[0]).to.have.property('id');

              initialAgent = response.agents[0];
              expect(initialAgent.name).to.eq('AdvancedEditorTestAgent');

              // Verify initial state doesn't have our test block
              const testBlock = initialAgent.memory.blocks.find(
                (block) => block.label === 'cypress_test_block'
              );
              expect(testBlock, 'Test block should not exist initially').to.not.exist;
            });
          });

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

            // Test preserveOnMigration checkbox - enable it
            cy.findByTestId('memory-block-preserve-on-migration-switch').click();

            // Test readOnly checkbox - keep it disabled for now (we'll test it later)

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

          // PHASE 2: Migration verification after block addition
          cy.testStep('Phase 2: Save template version and verify migration after block addition', () => {
            cy.get('body').click({ force: true });
            cy.stageAndDeployAgent();
          });



          cy.testStep('Phase 2: Verify initial agent was migrated with new block', () => {
            // Retrieve the updated initial agent using the API
            cy.request(`/v1/agents/${initialAgent.id}`)
              .its('body')
              .then((updatedAgent: AgentState) => {
                expect(updatedAgent.memory.blocks).to.be.an('array');

                const testBlock = updatedAgent.memory.blocks.find(
                  (block) => block.label === 'cypress_test_block'
                );
                expect(testBlock, 'Test block should exist after migration').to.exist;

                if (testBlock) {
                  expect(testBlock.value).to.contain('This is test content for the cypress memory block');
                  expect(testBlock.description).to.eq('A test memory block created by Cypress automation');
                  expect(testBlock.preserve_on_migration).to.eq(true);
                  expect(testBlock.read_only).to.eq(false);
                }
              });
          });

          cy.testStep('Phase 2: Navigate back to template editor', () => {
            // Navigate back to the template editor after deployment
            cy.visitWithDevDelay(`/projects/${templateInfo.projectSlug}/templates/${templateInfo.templateName}`);
            // Reopen the advanced memory editor
            cy.findByTestId('open-advanced-memory-editor', {
              timeout: 50000,
            }).click();
          });

          cy.testStep('Phase 2: Create new agent and verify it gets the new block', () => {
            cy.createEntitiesFromTemplate({
              templateVersion: `${templateInfo.templateVersion.replace(':current', ':latest')}`,
              agentName: 'NewAgentWithBlock',
              tags: ['new-test-with-block']
            }).then((response) => {
              expect(response.agents).to.be.an('array');

              const newAgent = response.agents[0];
              expect(newAgent.memory.blocks).to.be.an('array');
              expect(newAgent.name).to.eq('NewAgentWithBlock');

              const testBlock = newAgent.memory.blocks.find(
                (block) => block.label === 'cypress_test_block'
              );
              expect(testBlock, 'New agent should have the test block').to.exist;

              if (testBlock) {
                expect(testBlock.value).to.contain('This is test content for the cypress memory block');
                expect(testBlock.preserve_on_migration).to.eq(true);
                expect(testBlock.read_only).to.eq(false);
              }
            });
          });

          // PHASE 3: Migration verification after block deletion with readOnly testing
          cy.testStep('Phase 3: Test readOnly functionality and modify block', () => {
            // Select the memory block
            cy.findByTestId('memory-block-cypress_test_block').click();

            // Enable readOnly checkbox to test this functionality
            cy.findByTestId('advanced-memory-editor-readonly-checkbox').click();

            // Verify preserveOnMigration checkbox is checked (from creation) (check if data-state="checked")
            cy.findByTestId('advanced-memory-editor-preserve-on-migration-checkbox')
              .should('have.attr', 'data-state', 'checked');

            // Update the memory block with readOnly enabled
            cy.findByTestId('advanced-memory-editor-update').click();

            // Wait for the update to complete
            cy.wait(2000);
          });

          cy.testStep('Phase 3: Verify readOnly works and deploy', () => {
            // Deploy to save readOnly state
            cy.get('body').click({ force: true });
            cy.stageAndDeployAgent();
          });

          cy.testStep('Phase 3: Navigate back and verify readOnly state', () => {
            // Navigate back to the template editor
            cy.visitWithDevDelay(`/projects/${templateInfo.projectSlug}/templates/${templateInfo.templateName}`);
            // Reopen the advanced memory editor
            cy.findByTestId('open-advanced-memory-editor', {
              timeout: 50000,
            }).click();
          });

          cy.testStep('Phase 3: Verify readOnly migration and delete the block', () => {
            // Verify the updated agent has readOnly enabled
            cy.request(`/v1/agents/${initialAgent.id}`)
              .its('body')
              .then((updatedAgent: AgentState) => {
                const testBlock = updatedAgent.memory.blocks.find(
                  (block) => block.label === 'cypress_test_block'
                );
                expect(testBlock, 'Test block should still exist').to.exist;
                if (testBlock) {
                  expect(testBlock.read_only).to.eq(true);
                  expect(testBlock.preserve_on_migration).to.eq(true);
                }
              });

            // Now delete the memory block
            cy.findByTestId('memory-block-cypress_test_block').click();
            cy.findByTestId('delete-memory-block', { timeout: 5000 }).click();
            cy.findByTestId('delete-memory-block-dialog-confirm-button').click();
          });

          cy.testStep('Phase 3: Verify memory block was deleted from UI', () => {
            // Verify the memory block no longer exists in the sidebar
            cy.findByTestId('memory-block-cypress_test_block', {
              timeout: 5000,
            }).should('not.exist');
          });

          cy.testStep('Phase 3: Save template version and verify migration after block deletion', () => {
            cy.get('body').click({ force: true });
            cy.stageAndDeployAgent();
          });

          cy.testStep('Phase 3: Navigate back to template editor for final verification', () => {
            // Navigate back to the template editor after deployment
            cy.visitWithDevDelay(`/projects/${templateInfo.projectSlug}/templates/${templateInfo.templateName}`);
          });

          cy.testStep('Phase 3: Verify initial agent was migrated with block removed', () => {
            // Retrieve the updated initial agent using the API
            cy.request(`/v1/agents/${initialAgent.id}`)
              .its('body')
              .then((updatedAgent: AgentState) => {
                expect(updatedAgent.memory.blocks).to.be.an('array');

                const testBlock = updatedAgent.memory.blocks.find(
                  (block) => block.label === 'cypress_test_block'
                );
                expect(testBlock, 'Test block should be removed after migration').to.not.exist;
              });
          });

          cy.testStep('Phase 3: Create final new agent and verify block is absent', () => {
            cy.createEntitiesFromTemplate({
              templateVersion: `${templateInfo.templateVersion.replace(':current', ':latest')}`,
              agentName: 'FinalAgentWithoutBlock',
              tags: ['final-test-without-block']
            }).then((response) => {
              expect(response.agents).to.be.an('array');

              const newAgent = response.agents[0];
              expect(newAgent.memory.blocks).to.be.an('array');
              expect(newAgent.name).to.eq('FinalAgentWithoutBlock');

              const testBlock = newAgent.memory.blocks.find(
                (block) => block.label === 'cypress_test_block'
              );
              expect(testBlock, 'Final new agent should not have the deleted test block').to.not.exist;
            });
          });
        },
      );

      it(
        'should manage environment variables',
        { tags: ['@environment-variables'] },
        () => {
          cy.testStep('Add environment variable', () => {
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
          });
        },
      );

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
            cy.location('pathname').then((pathname) => {
              // path comes from /projects/:projectSlug/templates/:templateName/distribution
              const templateName = pathname.split('/')[4];
              cy.request({
                method: 'POST',
                url: '/v1/agents',
                body: {
                  from_template: `${templateName}:latest`,
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
        },
      );
    });
  },
);
