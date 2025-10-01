describe(
  'Onboarding Flow',
  { tags: ['@onboarding', '@e2e', '@smoke'] },
  () => {


    beforeEach(() => {
      cy.googleLoginWithSession();
      cy.seedTestData();
    });

    afterEach(() => {
      cy.cleanupTestData();
    });

    describe('Complete Onboarding Flow', () => {
      it(
        'should complete the full onboarding journey from settings to tour completion',
        { tags: ['@onboarding-complete'] },
        () => {
          cy.testStep('Navigate to settings profile page', () => {
            cy.visitWithDevDelay('/settings/profile');
            cy.get('h1').contains(/Account overview/, { timeout: 30000 });
          });

          cy.testStep('Click retry onboarding button', () => {
            cy.findByTestId('unpause-onboarding-button', { timeout: 30000 })
              .click();
          });

          cy.testStep('Start onboarding from dialog', () => {
            // Wait for the StartOnboardingDialog to appear
            cy.findByTestId('start-onboarding-button', { timeout: 30000 })
              .should('be.visible')
              .should('not.be.disabled')
              .click();
          });

          cy.testStep('Wait for navigation to agents page', () => {
            // Should be redirected to the agent page after onboarding starts
            cy.location('pathname', { timeout: 50000 }).should(
              'match',
              /\/projects\/(.+)\/agents\/(.+)/,
            );
          });

          cy.testStep('Send initial message in chat simulator', () => {
            // Click send button
            cy.findByTestId('chat-simulator-send', { timeout: 30000 })
              .should('be.visible')
              .should('not.be.disabled')
              .click({ force: true });
          });

          cy.testStep('Progress through the Quick ADE Tour - Step 1 (Simulator)', () => {
            // Wait for the first tour step to appear (simulator step)
            cy.findByTestId('onboarding-next-to-memory', { timeout: 30000 })
              .should('be.visible')
              .click();
          });

          cy.testStep('Progress through the Quick ADE Tour - Step 2 (Memory)', () => {
            // Wait for the memory tour step and click next
            cy.findByTestId('onboarding-next-to-tools', { timeout: 30000 })
              .should('be.visible')
              .click();

          });

          cy.testStep('Progress through the Quick ADE Tour - Step 3 (Tools)', () => {
            // Wait for the tools tour step and finish
            cy.findByTestId('onboarding-next-finish', { timeout: 30000 })
              .should('be.visible')
              .click({ force: true });
          });

          cy.testStep('Verify onboarding completion', () => {
            // Verify that the tour overlay is no longer visible
            // This might take a moment as the tour finishes
            cy.findByTestId('onboarding-next-finish', { timeout: 10000 })
              .should('not.exist');

            // Verify we're still on the agent page
            cy.location('pathname', { timeout: 10000 }).should(
              'match',
              /\/projects\/(.+)\/agents\/(.+)/,
            );
          });
        },
      );

    });
  },
);
