describe('letta', () => {
  beforeEach(() => cy.visit('/'));

  it('should log in and visit project home ', () => {
    cy.googleLogin();

    cy.get('h1').contains(/Project Home/);
  });
});
