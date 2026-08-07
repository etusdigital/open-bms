# Proposta: endpoint temporário de exportação de contatos no BMS legado

Status: proposta, aguardando revisão.

O importador do open-bms perde contatos e não consegue recuperar o email real dos que importa. A causa não está do lado do consumidor — está no que a origem entrega. Esta proposta especifica o contrato de um endpoint temporário no BMS legado que fecha os dois buracos, e define quando ele sai do ar.

Não há script aqui: o consumidor já existe. O `EnterpriseSession` (`apps/enterprise-import/src/enterprise-client/enterprise.client.ts`) já pagina dez rotas da origem com retry exponencial, backoff de 60s em 429 e tolerância a 404. O endpoint novo entra como mais uma fonte e herda paginação, retentativa, checkpoint e retomada sem código novo do lado de cá.

## O que quebra hoje

**O email vem mascarado.** O `GET /contacts` do legado devolve `lucas***@gmail.com`, e o importador não tem como recuperar o endereço. É a razão de existir do módulo de reconcile em `apps/msgops-api/src/modules/enterprise-import`, que hoje remedia isso cruzando um CSV exportado à mão contra as linhas já importadas, casando por `created_at`. O endpoint proposto torna esse remendo desnecessário para importações futuras.

**Não há total confiável.** O `/contacts` devolve `total` igual ao tamanho da página, não ao total da coleção. Por isso o `ContactsImporter` declara `reportsTotal = false`: sem denominador, o progresso do job não sabe dizer quanto falta, e não existe número contra o qual comparar o que entrou. É o que impede declarar sucesso de uma importação.

**A paginação não é estável.** A importação da conta 2 levou 376 páginas. Sobre uma tabela viva, paginação por offset sem ordenação garantida faz linha pular de página: algumas são lidas duas vezes, outras nunca. O contador de descartes recém-adicionado ao importador não enxerga a segunda categoria — uma linha que a origem nunca entregou não aparece em lugar nenhum.

## Contrato proposto

### Rota

```
GET /contacts/export/full
```

Caminho de dois segmentos por baixo de `/contacts` **de propósito**. Um `/contacts/export` de segmento único colide com a rota `/contacts/:id` numa instância ainda não redeployada: o handler tenta interpretar `export` como inteiro e devolve 500, que derrota o `tolerate404` e derruba o job inteiro num laço de retentativa. Com dois segmentos, uma instância antiga devolve 404 limpo, que o cliente converte em página vazia. Essa lição já custou caro em `/contacts/custom-fields/values` — está documentada no próprio cliente.

### Autenticação

Cabeçalho `x-api-key`. **Não** `Authorization: Bearer`.

Os dois caem em validações diferentes no legado, verificado contra `msgops-api.etus.digital`:

```
sem credencial          → 401 {"message":"Unauthorized"}
Authorization: Bearer   → 401 {"message":"Invalid token"}     ← validação de JWT
x-api-key               → 401 {"message":"Invalid API key"}   ← validação de chave gerenciada
```

A chave temporária cabe no modelo existente sem mecanismo novo: o job de importação já guarda `enterprise_base_url` e `encrypted_api_key` (`enterprise-import-job.entity.ts`).

### Parâmetros

| Parâmetro      | Tipo | Default | Observação                                    |
| -------------- | ---- | ------- | --------------------------------------------- |
| `page`         | int  | 1       | 1-based, como as demais rotas consumidas      |
| `itemsPerPage` | int  | 1000    | teto de 5000; ver limites operacionais abaixo |

São os mesmos nomes que o `EnterpriseSession.paged()` já envia. Qualquer outro nome exige mudança no cliente.

### Resposta

```json
{
  "results": [
    /* contatos */
  ],
  "page": 1,
  "totalItems": 375362,
  "itemsPerPage": 1000
}
```

`totalItems` precisa ser o **total da coleção**, não o tamanho da página. É o requisito mais importante depois do email cru: é ele que permite ao `ContactsImporter` voltar a declarar `reportsTotal = true` e dá o denominador que hoje não existe.

### Campos por contato

Obrigatórios:

| Campo        | Por quê                                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `uuid`       | Chave natural do contato é `(account_id, uuid)`. Não é o email, que não é único por conta na origem. Export sem `uuid` inviabiliza idempotência e retomada.  |
| `email`      | Cru, sem máscara. É o campo que motiva o endpoint.                                                                                                           |
| `created_at` | Timestamp de origem, ISO-8601 **com offset**. Viabiliza a reconciliação em sessão caso algum dado ainda chegue mascarado, e preserva a data real do contato. |

Além desses, todas as colunas que o contato já carrega hoje. O importador copia por nome de coluna e ignora o que não reconhece, então campo a mais não quebra nada — campo a menos vira coluna vazia.

Serialização em `snake_case` ou `camelCase`, indiferente: o `BaseImporter` aceita as duas. O que não pode é **misturar as duas formas do mesmo campo na mesma resposta**.

### Paginação estável

A resposta precisa ser ordenada por uma chave **imutável e monotônica** — na prática, `ORDER BY id`.

Ordenar por `id` não elimina o problema, mas o reduz ao caso que não nos afeta: com inserções durante a exportação, as linhas novas entram no fim e as páginas já lidas não se deslocam. Ordenação por `created_at` ou por qualquer coluna mutável não dá essa garantia. Deleções durante a janela ainda deslocam, e por isso a exportação deve rodar numa janela curta.

Se o legado puder oferecer paginação por cursor (`since_id`), é estritamente melhor e vale a mudança no cliente — mas não é bloqueante.

## Limites operacionais

O cliente tem timeout de **30s por requisição** e não é configurável por rota. Uma página que demore mais falha, entra em retry exponencial e, esgotadas 5 tentativas, derruba o job. A implementação precisa servir 1000 contatos dentro desse orçamento; se não servir, o teto de `itemsPerPage` desce, não o timeout sobe.

Rate limiting: 429 é respeitado com 60s de espera e no máximo 3 tentativas. Acima disso o job falha. Se houver limite por chave, ele precisa acomodar ~376 requisições sequenciais em janela contínua.

5xx e timeout são retentados com backoff de 1s a 16s. 4xx que não seja 429 é fatal e imediato.

## Como isso sai do ar

Endpoint temporário sem data de saída vira permanente. Duas travas, uma por decisão e outra estrutural:

**Data de saída: 31 de outubro de 2026.** Cobre a importação do BHZ e a de Etus e Brius com folga, e ainda deixa margem para uma reimportação corretiva.

**Expiração na própria chave.** A chave temporária deve ser emitida com validade, não como chave perpétua a ser revogada depois. Data no calendário depende de alguém lembrar; chave expirada morre sozinha. Se o legado não suportar chave com validade, essa é a primeira coisa a resolver — sem isso, "temporário" é só intenção.

**Quem remove: a definir.** Precisa de nome antes do merge desta proposta. Sem dono, a data acima é decorativa.

## Fora de escopo

Não faz parte desta proposta: exportar tags, campos customizados, automações ou campanhas — o pipeline atual já cobre esses e nenhum deles sofre com máscara. Também não propõe mudar o `/contacts` existente: o endpoint novo é aditivo, para que instâncias não atualizadas continuem funcionando.

## Verificação depois de no ar

Uma chamada de fumaça, com a chave temporária:

```bash
curl -s -H "x-api-key: $CHAVE" \
  "$BASE/contacts/export/full?page=1&itemsPerPage=5" | jq '{
    totalItems,
    itemsPerPage,
    devolvidos: (.results | length),
    primeiro: (.results[0] | {uuid, email, created_at})
  }'
```

Três coisas a conferir na saída: `totalItems` maior que `itemsPerPage` (prova que não é o tamanho da página), `email` sem `***`, e `uuid` presente. Se qualquer uma falhar, o endpoint não atende ao contrato.
