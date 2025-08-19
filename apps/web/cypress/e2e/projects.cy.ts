describe(
  'ADE Project Management',
  { tags: ['@ade', '@project-management', '@smoke'] },
  () => {
    let _testData: unknown;

    before(() => {
      cy.fixture('test-data').then((data) => {
        _testData = data;
      });
    });

    beforeEach(() => {
      cy.googleLoginWithSession();
      cy.seedTestData();
    });

    afterEach(() => {
      cy.cleanupTestData();
    });

    describe('Project Creation', () => {
      it(
        'should create new project successfully',
        { tags: ['@project-creation'] },
        () => {
          cy.testStep('Navigate to projects page', () => {
            cy.visitWithDevDelay('/projects');
            cy.get('h1').contains(/Projects/);
          });

          cy.testStep('Create new project', () => {
            cy.findAllByTestId('create-project-button').first().click();
            cy.findByTestId('project-name-input').type('CYDOGGTestProject');
            cy.findByTestId('create-project-dialog-confirm-button').click();
          });

          cy.testStep('Verify project creation', () => {
            cy.location('pathname', { timeout: 50000 }).should(
              'match',
              /\/projects\/(.+)/,
            );
          });
        },
      );

    });
  },
);
