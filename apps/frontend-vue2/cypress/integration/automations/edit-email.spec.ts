/// <reference types="cypress" />

describe('WriteEmail', () => {
  before(() => {
    //@ts-ignore
    cy.identityServerAPILogin();
    cy.get('[data-cy=automation-link]').click();
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
    cy.intercept('GET', 'http://localhost:5000/automations', { fixture: 'automations.json' });
  });

  it('deve ser possivel substituir os dados da mensagem', () => {
    cy.get('[data-cy=text-message-1]').trigger('mouseenter');
    cy.get('[data-cy=button-edit-message-1]').click();
    cy.get('[data-cy=modal-cancel').click();
  });

  it('campos devem iniciar preenchidos com dados da mensagem', () => {
    cy.get('[data-cy=automation-message-title]').invoke('val').should('not.be.empty');
    cy.get('[data-cy=name]').invoke('val').should('not.be.empty');
    cy.get('[data-cy=email]').invoke('val').should('not.be.empty');
    cy.get('[data-cy=subject]').invoke('val').should('not.be.empty');
  });

  it('deve ser possivel editar os campos do formulário', () => {
    cy.intercept('PUT', 'http://localhost:5000/automations/messages/1', {});

    cy.get('.note-editable').clear();
    cy.get('.note-editable').type('teste');
    cy.get('[data-cy=email]').clear();
    cy.get('[data-cy=email]').type('maria@email.com');
    cy.get('[data-cy=name]').clear();
    cy.get('[data-cy=name]').type('Maria');
    cy.get('[data-cy=subject]').clear();
    cy.get('[data-cy=subject]').type('Promoção especial');
    cy.get('[data-cy=automation-message-title]').clear();
    cy.get('[data-cy=automation-message-title]').type('Mensagem editada');

    cy.get('[data-cy=automation-message-save-btn]').click();
  });
});
