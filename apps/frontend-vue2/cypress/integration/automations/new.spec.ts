/// <reference types="cypress" />

describe('Automations', () => {
  before(() => {
    //@ts-ignore
    cy.identityServerAPILogin();
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
    cy.get('[data-cy=automation-link]').click();
  });

  it('deve exibir componente de adição de nova automação ao clicar no botão "adicionar nova automação"', () => {
    cy.get('[data-cy=add-automation-btn]').should('be.visible').click();
    cy.get('[data-cy=new-automation]').should('be.visible');
  });

  it('deve ser exibido input Titulo da automação', () => {
    cy.get('[data-cy=add-title-automation]').should('be.visible');
  });

  it('deve ser exibido switch Automação ativa', () => {
    cy.get('[data-cy=active-automation]').eq(0).should('be.visible');
  });

  it('deve ser exibido autocomplete Listas', () => {
    cy.get('[data-cy=list-automation]').should('be.visible');
  });

  it('deve ser exibido autocomplete Mensagem', () => {
    cy.get('[data-cy=message-automation]').should('be.visible');
  });

  it('deve ser possivel criar nova automacao', () => {
    // Given
    const title = 'Automação de teste';

    cy.intercept('POST', 'http://localhost:5000/automations', {});

    cy.get('[data-cy=button-save-0]').should('be.disabled');
    cy.get('[data-cy=add-title-automation]').type(title);
    cy.get('[data-cy=list-automation]').click();
    cy.get(`[role=option] > :nth-child(1)`).click();
    cy.get('[data-cy=message-automation]').click();
    cy.get('.v-list-item__title').contains('Message').parent().click();
    cy.get('[data-cy=button-save-0]').should('not.be.disabled').click();
    cy.get('[data-cy=modal-success]').should('be.visible').click();
  });
});
