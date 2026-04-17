/// <reference types="cypress" />

describe('WriteEmail', () => {
  before(() => {
    //@ts-ignore
    cy.identityServerAPILogin();
  });

  it('deve ser possível escolher o tipo de automação', () => {
    cy.get('[data-cy=automation-link]').click();
    cy.get('[data-cy=automation-email]').click();
    cy.get('[data-cy=btn-confirm]').click();
    cy.get('[data-cy=add-automation-message-btn]').click();
  });

  beforeEach(() => {
    cy.intercept('GET', 'http://localhost:5000/audiences/activecampaign', {
      name: 'quiz_answer_last30d_creditoimediato',
      id: '62279',
    });
    cy.intercept('GET', 'http://localhost:5000/automations/messages', {
      id: 1,
      title: 'Message',
      subject: 'SAAD',
      content: 'SVD',
      fromMail: 'SCS',
      fromName: 'CSDK',
      isTested: false,
      createdAt: '2021-03-10T13:37:29.189Z',
      updatedAt: '2021-03-10T13:37:29.189Z',
      deletedAt: null,
    });
    cy.intercept('GET', 'http://localhost:5000/automations', []);
  });

  it('deve ser exibido input Titulo da mensagem', () => {
    cy.get('[data-cy=automation-message-title]').should('be.visible');
  });

  it('deve ser exibido um tooltip ao lado do Titulo da Mensagem ', () => {
    cy.get('[data-cy=automation-message-title-info]').trigger('mouseenter');

    cy.get('[data-cy=automation-message-title-tooltip]').should('be.visible');
  });

  it('deve ser exibido input Assunto da mensagem', () => {
    cy.get('[data-cy=subject]').should('be.visible');
  });

  it('deve ser exibido input Nome do remetente', () => {
    cy.get('[data-cy=name]').should('be.visible');
  });

  it('deve ser exibido input Email do remetente', () => {
    cy.get('[data-cy=email]').should('be.visible');
  });

  it('deve ser exibido um botão para salvar os dados do email ', () => {
    cy.get('[data-cy=automation-message-save-btn]').should('be.visible');
  });

  it('deve mostrar mensagem de erro caso titulo tenha menos de 3 caracteres', () => {
    cy.get('[data-cy=automation-message-title]').type('te');
    cy.get('[data-cy=automation-message-title-error]').should('contain', 'São necessários 3 caracteres.');
    cy.get('[data-cy=automation-message-save-btn]').should('be.disabled');
  });

  it('não deve mostrar mensagem de erro caso titulo tenha mais de 3 caracteres', () => {
    cy.get('[data-cy=automation-message-title]').type('tes');
    cy.get('[data-cy=automation-message-title-error]').should('not.exist');
    cy.get('[data-cy=automation-message-save-btn]').should('be.disabled');
  });

  it('deve mostrar mensagem de erro caso nome tenha menos de 4 caracteres', () => {
    cy.get('[data-cy=name]').type('tes');
    cy.get('[data-cy=name-error]').should('contain', 'São necessários 4 caracteres.');
    cy.get('[data-cy=automation-message-save-btn]').should('be.disabled');
  });

  it('não deve mostrar mensagem de erro caso nome tenha mais de 4 caracteres', () => {
    cy.get('[data-cy=name]').type('teste');
    cy.get('[data-cy=name-error]').should('not.exist');
    cy.get('[data-cy=automation-message-save-btn]').should('be.disabled');
  });

  it('não deve mostrar mensagem de erro caso Assunto tenha mais de 3 caracteres', () => {
    cy.get('[data-cy=subject]').type('assunto');
    cy.get('[data-cy=subject-error]').should('not.exist');
    cy.get('[data-cy=automation-message-save-btn]').should('be.disabled');
  });

  it('deve mostrar mensagem de erro caso nao tenha um E-mail valido', () => {
    cy.get('[data-cy=email]').type('email');
    cy.get('[data-cy=email-error]').should('contain', 'E-mail inválido.');
    cy.get('[data-cy=automation-message-save-btn]').should('be.disabled');
  });

  it('não deve mostrar mensagem de erro caso E-mail esteja de acordo com as regras', () => {
    cy.get('[data-cy=email]').type('teste@email.com');
    cy.get('[data-cy=email-error]').should('not.exist');
    cy.get('[data-cy=automation-message-save-btn]').should('be.disabled');
  });

  it('deve redirecionar para rota de testes de engregabilidade ao salvar ', () => {
    cy.get('[data-cy=automation-message-save-btn]').click();
    cy.location('pathname').should('eq', '/automations/messages/test');
  });
});
