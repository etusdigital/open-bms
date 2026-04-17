/// <reference types="cypress" />

describe('Automations Filters', () => {
  before(() => {
    //@ts-ignore
    cy.identityServerAPILogin();
  });

  beforeEach(() => {
    cy.intercept('GET', 'http://localhost:5000/audiences/activecampaign', {
      name: 'quiz_answer_last30d_creditoimediato',
      id: '62279',
    });
    cy.intercept('GET', 'http://localhost:5000/automations', { fixture: 'automations.json' });
  });

  it('deve ser possível escolher o tipo de automação', () => {
    cy.get('[data-cy=automation-link]').click();
    cy.get('[data-cy=automation-email]').click();
    cy.get('[data-cy=btn-confirm]').click();
  });

  it('deve ser exibido componente de filtragem', () => {
    cy.get('[data-cy=automation-filter]').should('be.visible');
  });

  it('deve ser exibido dropdown Filtragem de status', () => {
    cy.get('[data-cy=status]').should('be.visible');
  });

  it('deve ser exibido dropdown Ordencao', () => {
    cy.get('[data-cy=orderby]').should('be.visible');
  });
  it('deve ser exibido autocomplete Filtragem por titulo', () => {
    cy.get('[data-cy=search]').should('be.visible');
  });

  it('a lista de automacoes deve ser atualizada ao filtrar', () => {
    cy.intercept('GET', 'http://localhost:5000/automations?title=Nome', {
      id: 1,
      title: 'Nome',
      audienceName: 'Nome da audiencia',
      audienceIdExternal: 1,
      message: {
        id: 1,
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
    });
    cy.get('[data-cy=search]').type('Nome');
    cy.get('.v-autocomplete__content .v-list-item').eq(0).click();
  });
});
