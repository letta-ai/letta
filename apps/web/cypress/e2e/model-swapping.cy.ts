import type { AgentState } from '@letta-cloud/sdk-core';

describe(
  'Model Swapping',
  { tags: ['@ade', '@model-swapping', '@critical'] },
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
      cy.cleanupTestData();
    });

    describe('Model Configuration', () => {
      beforeEach(() => {
        cy.googleLoginWithSession();
        cy.useDefaultAgentTemplate();
      });

      it(
        'should allow user to swap between models (gpt-4o and gpt-4.1-nano)',
        { tags: ['@model-swap'] },
        () => {
          let initialAgent: AgentState;
          let templateInfo: { projectSlug: string; templateName: string; templateVersion: string; fullTemplateVersion: string };

          cy.testStep('Create initial agent from current template state', () => {
            cy.getCurrentTemplateFromUrl().then((template) => {
              templateInfo = template;
              return cy.createEntitiesFromTemplate({
                templateVersion: template.fullTemplateVersion,
                agentName: 'ModelSwapTestAgent',
                tags: ['model-swap-test']
              });
            }).then((response) => {
              expect(response.agents).to.be.an('array');
              expect(response.agents[0]).to.have.property('id');

              initialAgent = response.agents[0];
              expect(initialAgent.name).to.eq('ModelSwapTestAgent');

              // Store initial model configuration
              expect(initialAgent.llm_config).to.have.property('model');
              cy.log(`Initial model: ${initialAgent.llm_config.model}`);
            });
          });

          cy.testStep('Verify ModelSelector is available in template editor', () => {
            // Wait for the AgentSettingsPanel to load
            cy.findByTestId('update-agent-name-button', {
              timeout: 50000
            }).should('exist');

            // Wait for model selector control to be visible
            cy.findByTestId('model-selector-trigger').should('exist');
          });

          cy.testStep('Switch to gpt-4o model', () => {
            // Click on the model selector control (react-select component)
            cy.findByTestId('model-selector-trigger').click({ force: true });


            // Look for gpt-4o option using the testId pattern from Select component
            cy.get('body').then(($body) => {
              if ($body.find('[data-testid="select-box-option-openai/gpt-4o"]').length > 0) {
                cy.findByTestId('select-box-option-openai/gpt-4o').click();
                cy.log('Selected gpt-4o model');
              } else {
                // Fallback: try to find any gpt-4o option
                cy.get('[role="option"]').contains('gpt-4o').first().click({ force: true });
                cy.log('Selected gpt-4o model (fallback)');
              }
            });

            // Wait for the model selection to update
            cy.wait(2000);
          });

          cy.testStep('Save template version with gpt-4o', () => {
            cy.get('body').click({ force: true });
            cy.stageAndDeployAgent();
          });

          cy.testStep('Verify initial agent was updated to gpt-4o', () => {
            // Retrieve the updated initial agent using the API
            cy.request(`/v1/agents/${initialAgent.id}`)
              .its('body')
              .then((updatedAgent: AgentState) => {
                expect(updatedAgent.llm_config).to.be.an('object');
                // Verify the model was updated (should contain gpt-4o)
                cy.log(`Updated model: ${updatedAgent.llm_config.model}`);
                expect(updatedAgent.llm_config.model).to.contain('gpt-4o');
              });
          });

          cy.testStep('Navigate back to template editor', () => {
            cy.visitWithDevDelay(`/projects/${templateInfo.projectSlug}/templates/${templateInfo.templateName}`);

            // Wait for template to load
            cy.findByTestId('update-agent-name-button', {
              timeout: 50000
            }).should('exist');
          });

          cy.testStep('Switch to gpt-4.1-nano model', () => {
            // Click on the model selector control again
            cy.findByTestId('model-selector-trigger').click({ force: true });

            // Wait for dropdown menu to appear
            cy.get('[role="listbox"]', { timeout: 10000 }).should('exist');

            // Look for gpt-4.1-nano option using the testId pattern
            cy.get('body').then(($body) => {
              if ($body.find('[data-testid="select-box-option-openai/gpt-4.1-nano"]').length > 0) {
                cy.findByTestId('select-box-option-openai/gpt-4.1-nano').click();
                cy.log('Selected gpt-4.1-nano model');
              } else {
                // Fallback: try to find any gpt-4.1-nano option
                cy.get('[role="option"]').contains('gpt-4.1-nano').first().click({ force: true });
                cy.log('Selected gpt-4.1-nano model (fallback)');
              }
            });

            // Wait for the model selection to update
            cy.wait(2000);
          });

          cy.testStep('Save template version with gpt-4.1-nano', () => {
            cy.get('body').click({ force: true });
            cy.stageAndDeployAgent();
          });

          cy.testStep('Verify initial agent was migrated to gpt-4.1-nano', () => {
            // Retrieve the updated initial agent using the API
            cy.request(`/v1/agents/${initialAgent.id}`)
              .its('body')
              .then((updatedAgent: AgentState) => {
                expect(updatedAgent.llm_config).to.be.an('object');
                // Verify the model was updated to gpt-4.1-nano
                cy.log(`Final model: ${updatedAgent.llm_config.model}`);
                expect(updatedAgent.llm_config.model).to.contain('gpt-4.1-nano');
              });
          });

          cy.testStep('Create new agent with latest model configuration', () => {
            cy.createEntitiesFromTemplate({
              templateVersion: `${templateInfo.templateVersion.replace(':current', ':latest')}`,
              agentName: 'NewAgentWithLatestModel',
              tags: ['new-test-with-latest-model']
            }).then((response) => {
              expect(response.agents).to.be.an('array');

              const newAgent = response.agents[0];
              expect(newAgent.llm_config).to.be.an('object');
              expect(newAgent.name).to.eq('NewAgentWithLatestModel');

              // Verify new agent has the gpt-4.1-nano model
              cy.log(`New agent model: ${newAgent.llm_config.model}`);
              expect(newAgent.llm_config.model).to.contain('gpt-4.1-nano');
            });
          });

          cy.testStep('Verify model swapping functionality', () => {
            // Navigate back to verify UI state
            cy.visitWithDevDelay(`/projects/${templateInfo.projectSlug}/templates/${templateInfo.templateName}`);

            // Verify the model selector shows the current selection
            cy.findByTestId('update-agent-name-button', {
              timeout: 50000
            }).should('exist');

            // Verify model selector is functional and shows current model
            cy.findByTestId('select-single-value-model-selector')
              .should('exist')
              .should('contain', 'gpt-4.1-nano');

            cy.log('Model swapping test completed successfully');
          });
        }
      );
    });
  }
);
