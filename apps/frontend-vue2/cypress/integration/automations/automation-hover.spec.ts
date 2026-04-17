/// <reference types="cypress" />

describe('Automations', () => {
  before(() => {
    //@ts-ignore
    // cy.identityServerAPILogin();
  });

  beforeEach(() => {
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
    cy.visit('https://localhost:44357/automations');
    // cy.get('[data-cy=automation-link]').click();
  });

  describe('Ao entrar na tela de Criação de Automação ', () => {
    it('deve existir um hover', () => {
      cy.get('[data-cy=switch-1]').should('not.be.visible').should('have.attr', 'aria-checked', 'false');
      cy.get('[data-cy=text-message-1]').trigger('mouseover');

      it('deve existir uma action preview', () => {
        cy.get('[data-cy=button-preview-message-1]').should('not.be.disabled').click();
        cy.get('[data-cy=modal-success]').should('not.be.disabled').click();
        cy.get('[data-cy=button-preview-message-1]').should('not.be.disabled').click();
        cy.get('[data-cy=modal-cancel]').should('not.be.disabled').click();
        cy.intercept('https://localhost:44357/automations/messages/1');
      });

      it('deve existir uma action edit', () => {
        cy.get('[data-cy=button-edit-message-1]').should('not.be.disabled').click();
        cy.intercept('https://localhost:44357/automations/messages/2');
      });

      it('deve existir uma action copy', () => {
        cy.get('[data-cy=button-copy-message-1]').should('not.be.disabled').click();

        cy.intercept('POST', 'http://localhost:5000/automations/messages/2/copy', {
          id: 3,
          title: 'Message (Copia 1)',
          subject: 'Assunto da mensagem',
          content: 'Conteudo da mensagem',
          fromMail: 'contato@email.com',
          fromName: 'Nome do remetente',
          isTested: false,
          createdAt: '2021-03-10T14:37:21.331Z',
          version: 1,
          updatedAt: null,
          deletedAt: null,
        });

        cy.intercept('https://localhost:44357/automations/messages/3');
      });

      it('deve existir uma action desassociar', () => {
        cy.intercept('PUT', 'http://localhost:5000/automations/disassociate/1', [
          {
            id: 1,
            title: 'Nome da automação',
            audienceName: 'Nome da audiencia',
            audienceIdExternal: 1,
            isActive: false,
            message: null,
          },
        ]);

        cy.get('[data-cy=button-close-message-1]').should('not.be.disabled').click();
        cy.get('[data-cy=modal-success]').should('not.be.disabled').click();
      });
    });
  });
});
