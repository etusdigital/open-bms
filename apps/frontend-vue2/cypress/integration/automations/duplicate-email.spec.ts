/// <reference types="cypress" />

describe('WriteEmail', () => {
  before(() => {
    //@ts-ignore
    cy.identityServerAPILogin();
  });

  beforeEach(() => {
    cy.intercept('GET', 'http://localhost:5000/automations/messages', {
      content: 'teste',
      createdAt: '2021-03-26T15:15:01.000Z',
      deletedAt: null,
      fromMail: 'joao@email.com',
      fromName: 'João',
      id: 1,
      isTested: false,
      subject: 'subject',
      title: 'Mensagem ',
      updatedAt: null,
      version: 1,
    });
    cy.intercept('GET', 'http://localhost:5000/automations', { fixture: 'automations.json' });

    cy.intercept('GET', 'http://localhost:5000/audiences/activecampaign', {
      name: 'quiz_answer_last30d_creditoimediato',
      id: '62279',
    });
    cy.wait(5000);
  });
  it('deve ser possível escolher o tipo de automação', () => {
    cy.get('[data-cy=automation-link]').click();
    cy.get('[data-cy=automation-email]').click();
    cy.get('[data-cy=btn-confirm]').click();
  });

  it('deve ser possivel salvar uma copia de uma mensagem existente', () => {
    cy.get('[data-cy=text-message-1]').trigger('mouseenter');
    cy.get('[data-cy=button-edit-message-1]').click();
  });

  it('campos devem iniciar preenchidos com dados da mensagem', () => {
    cy.get('[data-cy=automation-message-title]').invoke('val').should('not.be.empty');
    cy.get('[data-cy=name]').invoke('val').should('not.be.empty');
    cy.get('[data-cy=email]').invoke('val').should('not.be.empty');
    cy.get('[data-cy=subject]').invoke('val').should('not.be.empty');
  });

  it('deve ser possivel salvar os dados da cópia com os campos do formulário', () => {
    // cy.intercept('PUT', 'http://localhost:5000/automations/messages/2', {
    //   content: 'teste',
    //   createdAt: '2021-03-26T15:15:01.000Z',
    //   deletedAt: null,
    //   fromMail: 'joao@email.com',
    //   fromName: 'João',
    //   id: 2,
    //   isTested: false,
    //   subject: 'subject',
    //   title: 'Mensagem (Cópia 1)',
    //   updatedAt: null,
    //   version: 2,
    // });

    cy.wait(5000);
    cy.intercept('POST', 'http://localhost:5000/automations/messages/1/copy', {
      content: 'teste',
      createdAt: '2021-03-26T15:15:01.000Z',
      deletedAt: null,
      fromMail: 'joao@email.com',
      fromName: 'João',
      id: 2,
      isTested: false,
      subject: 'subject',
      title: 'Mensagem (Cópia 1)',
      updatedAt: null,
      version: 2,
    });
    cy.get('[data-cy=automation-message-save-btn]').click();
    cy.get('[data-cy=modal-success]').click();
  });
});
