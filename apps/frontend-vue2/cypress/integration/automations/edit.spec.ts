/// <reference types="cypress" />

describe('Automations', () => {
  before(() => {
    //@ts-ignore
    cy.identityServerAPILogin();
  });

  beforeEach(() => {
    cy.intercept('GET', 'http://localhost:5000/audiences/activecampaign', [
      {
        name: 'Nome da audiencia',
        id: '1',
      },
    ]);

    cy.intercept('GET', 'http://localhost:5000/automations/messages', [
      {
        id: 2,
        title: 'Message',
        subject: 'Assunto da mensagem',
        content: 'Conteudo da mensagem',
        fromMail: 'contato@email.com',
        fromName: 'Nome do remetente',
        isTested: false,
        createdAt: '2021-03-10T14:37:21.331Z',
        updatedAt: '2021-03-10T14:37:21.331Z',
        deletedAt: null,
      },
    ]);

    cy.intercept('GET', 'http://localhost:5000/automations', [
      {
        id: 1,
        title: 'Nome da automação',
        audienceName: 'Nome da audiencia',
        audienceIdExternal: 1,
        isActive: false,
        message: {
          id: 2,
          title: 'Message',
          subject: 'Assunto da mensagem',
          content: 'Conteudo da mensagem',
          fromMail: 'contato@email.com',
          fromName: 'Nome do remetente',
          isTested: false,
          createdAt: '2021-03-10T14:37:21.331Z',
          updatedAt: '2021-03-10T14:37:21.331Z',
          deletedAt: null,
        },
      },
    ]);
    cy.get('[data-cy=automation-link]').click();
  });

  it('deve existir um botão para editar automação', () => {
    const title = 'Automação de teste';
    cy.intercept('PUT', 'http://localhost:5000/automations', {});

    cy.get('[data-cy=switch-1]').should('not.be.visible').should('have.attr', 'aria-checked', 'false');
    cy.get('[data-cy=button-delete-1]').should('not.be.disabled');
    cy.get('[data-cy=button-save-1]').should('be.disabled');
    cy.get('[data-cy=button-edit-1]').should('not.be.disabled').click();
    cy.get('[data-cy=button-delete-1]').should('not.be.disabled');
    cy.get('[data-cy=button-edit-1]').should('be.disabled');
    cy.get('[data-cy=add-title-automation]').type(title);
    cy.get('[data-cy=list-automation]').click();
    cy.get(`[role=option] > :nth-child(1)`).click();
    cy.get('[data-cy=message-automation]').click();
    cy.get('.v-list-item__title').contains('Message').parent().click();
    cy.get('[data-cy=button-save-1]').should('not.be.disabled').click();
    cy.get('[data-cy=modal-success]').should('be.visible').click();
  });
});
