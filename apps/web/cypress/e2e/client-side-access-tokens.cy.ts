describe('Allow users to create and manage API keys', () => {
  beforeEach(() => {
    cy.googleLogin();
    cy.revokeAllClientSideAccessTokens();
  });

  afterEach(() => {
    cy.revokeAllClientSideAccessTokens();
  });

  it('should create a client side access token', () => {
    cy.request({
      url: '/v1/client-side-access-tokens',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        hostname: 'https://example.com',
        policy: [
          {
            // we just want to test if we can get past the auth, so if we return a 404, it actually did work properly
            id: 'agent-caa950d7-cee5-41e4-8d50-cb53af1c0903',
            type: 'agent',
            access: ['read_agent', 'write_agent'],
          },
        ],
      },
    }).then((response) => {
      expect(response.status).to.eq(201);
      expect(response.body).to.have.property('token');
      expect(response.body).to.have.property('hostname');
      expect(response.body).to.have.property('expiresAt');

      // attempt to use the token
      const token = response.body.token;

      // agent does not exist
      cy.request({
        url: '/v1/agents/agent-caa950d7-cee5-41e4-8d50-cb53af1c0903',
        failOnStatusCode: false,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).then((response) => {
        expect(response.status).to.eq(404);
      });

      cy.request({
        url: '/v1/agents/agent-245',
        method: 'GET',
        failOnStatusCode: false,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });
  });
});
