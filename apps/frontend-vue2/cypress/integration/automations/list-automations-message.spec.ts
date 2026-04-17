/// <reference types="cypress" />

describe('ListAutomationsMessage', () => {
  before(() => {
    cy.visit('https://localhost:44357');
    //@ts-ignore
    cy.identityServerAPILogin();

    const data = [
      {
        id: 1,
        title: 'Titulo da mensagem',
        subject: 'Assunto da mensagem',
        content: 'Conteudo da mensagem',
        fromMail: 'contato@email.com',
        fromName: 'Nome do remetente',
        isTested: false,
        createdAt: '2021-03-10T14:37:21.331Z',
        updatedAt: '2021-03-10T14:37:21.331Z',
        deletedAt: null,
      },
      {
        id: 2,
        title: 'Teste',
        subject: 'Assunto da mensagem',
        content: 'Conteudo da mensagem',
        fromMail: 'contato@email.com',
        fromName: 'Nome do remetente',
        isTested: false,
        createdAt: '2021-03-10T14:37:21.331Z',
        updatedAt: '2021-03-10T14:37:21.331Z',
        deletedAt: null,
      },
    ];

    cy.intercept('GET', 'http://localhost:5000/automations/messages?page=0&itemsPerPage=10', {
      data,
    });

    cy.intercept('GET', 'http://localhost:5000/automations/messages?page=0&itemsPerPage=10&title=teste', {
      data: data[0],
    });

    cy.wait(5000);

    cy.visit('https://localhost:44357/automations/list/messages');
  });

  describe('Ao entrar na tela da lista de mensagens', () => {
    it('deve ser possivel digitar um titulo no filtro', () => {
      // Given
      const title = 'teste';

      cy.get('[data-cy=automation-message-title]').type(title);
    });
  });
});
