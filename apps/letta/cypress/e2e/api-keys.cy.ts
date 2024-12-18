const API_KEY_NAME = 'APIKEYTEST';

describe('Allow users to create and manage API keys', () => {
  beforeEach(() => {
    cy.googleLogin();
    cy.deleteApiKeyWithName(API_KEY_NAME);
  });

  afterEach(() => {
    cy.deleteApiKeyWithName(API_KEY_NAME);
  });

  it('should create an api key', () => {
    cy.visit('/api-keys');

    cy.get('h1').contains(/API keys/);

    cy.location('pathname').should('match', /\/api-keys/);

    cy.findAllByTestId('create-api-key-button').first().click();

    cy.findByTestId('api-key-name-input').type(API_KEY_NAME);

    cy.findByTestId('create-api-key-dialog-confirm-button').click();

    cy.findByTestId('create-api-key-dialog-cancel-button').click();

    cy.findByTestId(`api-key-actions-button:${API_KEY_NAME}`).click();

    cy.findByTestId(`view-api-key-button:${API_KEY_NAME}`).click();

    let apiKey = '';

    // copy the input value
    cy.findByTestId(`view-api-key-input:${API_KEY_NAME}`).then(($input) => {
      apiKey = `${$input.val()}`;

      cy.request({
        url: '/v1/health',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
      });
    });

    cy.findByTestId(
      `view-api-key-dialog:${API_KEY_NAME}-cancel-button`
    ).click();

    cy.findByTestId(`delete-api-key-button:${API_KEY_NAME}`).click();

    cy.findByTestId(
      `delete-api-key-dialog:${API_KEY_NAME}-confirm-button`
    ).click();

    cy.findByTestId(`api-key-actions-button:${API_KEY_NAME}`).should(
      'not.exist'
    );

    // send a request with the deleted api key

    cy.request({
      url: '/v1/health',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(401);
    });
  });
});
