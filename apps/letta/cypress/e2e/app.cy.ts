describe('letta', () => {
  beforeEach(() => cy.visit('/'));

  it('should be redirected to login page', () => {
    cy.visit('/');
    cy.location('pathname').should('eq', '/login');
  });

  it('should log in and visit project home ', () => {
    cy.googleLogin();

    cy.get('h1').contains(/Project Home/);
  });
});
