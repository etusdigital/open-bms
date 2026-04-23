// Legacy IdentityServer login flow.
//
// Configure via cypress.json / cypress env:
//   CYPRESS_IDSRV_URL              — e.g. https://idsrv.example.com
//   CYPRESS_APP_URL                — e.g. https://localhost:44357
//   CYPRESS_AUTHORIZE_CALLBACK     — full querystring for /connect/authorize/callback
//   CYPRESS_LOGIN_USERNAME         — test user
//   CYPRESS_LOGIN_PASSWORD         — test password
//
// If IDSRV_URL is not configured, the command is a no-op (skips login),
// which keeps the suite compilable on a fresh clone.
Cypress.Commands.add('identityServerAPILogin', () => {
  const idsrvUrl = Cypress.env('IDSRV_URL');
  const appUrl = Cypress.env('APP_URL') || 'http://localhost:44357';
  const authorizeCallback = Cypress.env('AUTHORIZE_CALLBACK');
  const username = Cypress.env('LOGIN_USERNAME');
  const password = Cypress.env('LOGIN_PASSWORD');

  if (!idsrvUrl || !username || !password || !authorizeCallback) {
    cy.log(
      'identityServerAPILogin skipped: missing CYPRESS_IDSRV_URL / LOGIN_USERNAME / LOGIN_PASSWORD / AUTHORIZE_CALLBACK'
    );
    return;
  }

  cy.intercept('http://localhost:5000/campaigns', []);
  cy.visit(`${appUrl}/campaigns`);
  cy.wait(5000);
  cy.request('GET', `${idsrvUrl}/Account/Login`).then((response) => {
    const htmlDocument = document.createElement('html');
    htmlDocument.innerHTML = response.body;
    const loginForm = htmlDocument.getElementsByTagName('form')[0];
    const requestVerificationToken = loginForm.elements.__RequestVerificationToken.value;

    cy.request({
      method: 'POST',
      url: `${idsrvUrl}/Account/Login`,
      followRedirect: false,
      form: true,
      body: {
        ReturnUrl: authorizeCallback,
        Username: username,
        Password: password,
        button: 'login',
        __RequestVerificationToken: requestVerificationToken,
      },
    });
  });
  cy.intercept('http://localhost:5000/campaigns', []);
  cy.visit(`${appUrl}/campaigns`);
  cy.wait(5000);
});
