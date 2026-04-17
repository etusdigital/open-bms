Cypress.Commands.add('identityServerAPILogin', () => {
  cy.intercept('http://localhost:5000/campaigns', []);
  cy.visit('https://localhost:44357/campaigns');
  cy.wait(5000);
  cy.request('GET', 'https://etus-idsrv-dev.etus.digital/Account/Login').then((response) => {
    const htmlDocument = document.createElement('html');
    htmlDocument.innerHTML = response.body;
    const loginForm = htmlDocument.getElementsByTagName('form')[0];
    const requestVerificationToken = loginForm.elements.__RequestVerificationToken.value;

    cy.request({
      method: 'POST',
      url: 'https://etus-idsrv-dev.etus.digital/Account/Login',
      followRedirect: false,
      form: true,
      body: {
        ReturnUrl:
          '/connect/authorize/callback?client_id=vuejs_code_client&redirect_uri=https%3A%2F%2Flocalhost%3A44357%2Fcallback.html&response_type=code&scope=openid%20api1&state=fe62305f16164d7f9389cb25b5d99db8&code_challenge=rYG8kXN3UHEX_JnDnbQfoJf_CpwTVotw8auLoUHRZKQ&code_challenge_method=S256&response_mode=query',
        Username: 'bob',
        Password: 'Senha@123',
        button: 'login',
        __RequestVerificationToken: requestVerificationToken,
      },
    });
  });
  cy.intercept('http://localhost:5000/campaigns', []);
  cy.visit('https://localhost:44357/campaigns');
  cy.wait(5000);
});
