# Web Push (Firebase Cloud Messaging)

Guia operacional para configurar o web push do BMS com um projeto Firebase
próprio.

> **Princípio: single-project.** Existe **um** projeto Firebase por instalação
> do BMS, compartilhado por todas as contas. A configuração é global
> (`system_config.fcm_settings`), não por conta. O que varia por conta são só as
> variáveis de conteúdo do push (`webpush_settings`).

## Artefatos servidos

Nenhum desses arquivos existe em disco — todos são renderizados a partir de
templates versionados em `apps/msgops-api/src/assets/push/`.

| Artefato             | Rota / destino                   | Template           | Gerado por                                        | Quando         |
| -------------------- | -------------------------------- | ------------------ | ------------------------------------------------- | -------------- |
| `web-push.js`        | `GET /bms/web-push.js`           | `web-push-core.js` | `buildWebPush`                                    | a cada request |
| `bmstrk.js`          | `GET /bms/bmstrk.js`             | `bmstrk-core.js`   | `buildTracker`                                    | a cada request |
| SW da conta          | `GET /bms/push/:accountHash.js`  | `bms-sw-core.js`   | `AccountsService.renderAccountServiceWorker`      | a cada request |
| `bms-sw.js` (legado) | `{BMS_ASSETS_URL}/bms/bms-sw.js` | `bms-sw-core.js`   | `AdminFcmService.regeneratePlatformServiceWorker` | no save do FCM |

O caminho legado publica no S3/CDN e exige `BMS_ASSETS_URL`. **A rota servida é a
fonte da verdade** — uma instalação nova não precisa de bucket público.

### Como o `web-push.js` recebe a config

O `web-push-core.js` é um bundle vendorado do SDK do Firebase com um projeto
hardcoded nos literais. `buildWebPush` faz substituição **valor-por-valor** (com
aspas, para não casar substrings) dos 7 campos do `firebaseConfig` e do
`vapidKey`.

A substituição precisa acontecer no literal, e não via override no snippet da
página: o construtor do `bmsPush` chama `initializeApp(this.firebaseConfig)` num
_field initializer_, que roda **antes** da linha que aplica `e.firebaseConfig`.
Um valor vindo do snippet chegaria tarde demais e o `getToken` continuaria
cunhando contra o projeto do bundle.

**Portão all-or-nothing:** a troca do `firebaseConfig` só ocorre se os 6 campos
obrigatórios (`apiKey`, `projectId`, `messagingSenderId`, `appId`, `authDomain`,
`storageBucket`) estiverem presentes. Config parcial não substitui nada — melhor
manter o bundle inteiro coerente do que gerar um Frankenstein que cunha tokens
mortos.

## Pré-requisitos: o que pegar no Firebase Console

| Valor                       | Onde                                                                           | Sensível?                         |
| --------------------------- | ------------------------------------------------------------------------------ | --------------------------------- |
| Service account JSON        | ⚙️ Configurações do projeto → **Contas de serviço** → Gerar nova chave privada | 🔴 **Sim** (contém `private_key`) |
| `firebaseConfig` (7 campos) | Configurações do projeto → **Geral** → Seus apps → app **Web**                 | Não — é código de cliente         |
| VAPID public key            | Configurações do projeto → **Cloud Messaging** → Certificados push da Web      | Não — a privada fica no Google    |

Se não houver par de chaves em Cloud Messaging, clique em **Gerar par de
chaves**. Sem app Web cadastrado, crie um — é ele que produz o `firebaseConfig`.

O `project_id` precisa ser **o mesmo** nos três. Chave de um projeto com config
de outro é o erro mais comum, e falha silenciosamente.

### Onde guardar

Fora de qualquer working tree de git, para que a chave não seja commitada por
acidente:

```bash
mkdir -p ~/.bms-secrets && chmod 700 ~/.bms-secrets
mv ~/Downloads/<projeto>-firebase-adminsdk-*.json ~/.bms-secrets/fcm-service-account.json
chmod 600 ~/.bms-secrets/fcm-service-account.json
```

## Setup

Toda a configuração vive na Super Admin UI (persistida em `system_config`); não
há env var para as credenciais.

1. Logue como super-admin → **Integrações** → **FCM**.
2. Preencha os três campos:
   - **Service Account JSON** — conteúdo do arquivo baixado.
   - **Firebase Web Config** — pode colar o snippet inteiro do console; o parser
     aceita tanto JSON estrito quanto o formato `const firebaseConfig = {...}`.
   - **VAPID Public Key** — a chave pública (~87 chars, começa com `B`).
3. Salve.

> **Salve os três de uma vez.** Só o `webConfig` sem o VAPID deixa a instância
> num estado quebrado **silencioso**: o `firebaseConfig` já aponta para o projeto
> novo, mas o `vapidKey` continua o do bundle. O `getToken` cunha contra um par
> inconsistente e não emite erro algum. O VAPID é substituído fora do portão
> all-or-nothing, então não há nada que barre esse estado.

O botão **Testar conexão** não valida a credencial: ele faz `JSON.parse` e
devolve o `project_id`. Uma chave revogada, expirada ou de outro projeto passa
verde. A primeira validação real acontece quando o worker `send-push` tenta
enviar.

## Acesso super-admin em dev local

Se você não tem a senha do super-admin da sua instância local, redefina o hash
direto no banco. Bcrypt com 12 rounds, que é o custo usado pelo
`LocalAuthProvider`:

```bash
# 1. gerar o hash (dentro do container, que já tem o bcrypt instalado)
docker exec msgops-api node -e "console.log(require('bcrypt').hashSync('<NOVA_SENHA>',12))"

# 2. aplicar
docker exec postgres psql -U postgres -d msgops \
  -c "UPDATE user_credentials SET password_hash='<HASH>', updated_at=now() WHERE user_id=<ID>;"
```

Se o `UPDATE` devolver `UPDATE 0`, a linha de credencial não existe (o
`updatePassword` faz upsert, e pode nunca ter rodado para esse usuário):

```bash
docker exec postgres psql -U postgres -d msgops \
  -c "INSERT INTO user_credentials (user_id, password_hash) VALUES (<ID>, '<HASH>');"
```

Para descobrir o usuário super-admin:

```bash
docker exec postgres psql -U postgres -d msgops \
  -c "SELECT u.id, u.email, r.name FROM users u JOIN roles r ON r.id = u.global_role_id;"
```

## Verificação

O `web-push.js` é público — dá para conferir sem autenticação:

```bash
curl -s http://localhost:5001/bms/web-push.js | grep -o "projectId: '[^']*'" | head -1
```

Deve devolver o `projectId` do **seu** projeto. Se ainda aparecer o projeto do
bundle, a config não chegou (veja o troubleshooting abaixo).

Confirmar o VAPID e o SW da conta — o `accountHash` da rota é o `sha256` do id da
conta em hex:

```bash
curl -s http://localhost:5001/bms/web-push.js | grep -c "<SUA_VAPID_PUBLIC_KEY>"
curl -s "http://localhost:5001/bms/push/$(printf 1 | sha256sum | cut -d' ' -f1).js" | head -5
```

E o que ficou persistido:

```bash
docker exec postgres psql -U postgres -d msgops \
  -c "SELECT jsonb_pretty(value::jsonb - 'serviceAccountJson') FROM system_config WHERE key = 'fcm_settings';"
```

## Troubleshooting

| Sintoma                                              | Causa provável                                                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `web-push.js` ainda com o projeto do bundle          | Config incompleta — o portão all-or-nothing exige os 6 campos obrigatórios. Confira se o `firebaseConfig` colado tem todos.                      |
| Token é gerado mas nenhuma notificação chega         | VAPID não salvo junto com o `webConfig`. Salve os três novamente.                                                                                |
| `PUT` devolveu 200 mas o `bms-sw.js` do S3 não mudou | A regeneração é `.catch(warn)` não-fatal e retorna `null` sem `BMS_ASSETS_URL`. A resposta 200 não prova publicação. Irrelevante fora do legado. |
| `Testar conexão` verde e envio falhando              | O teste só faz `JSON.parse`. Cheque os logs do worker `send-push`.                                                                               |
| `ENOENT` em `web-push-core.js` em produção           | Os assets não foram copiados para `dist/`. Confirme a config de `assets` no `nest-cli.json` do build.                                            |
| SW da conta 404                                      | `accountHash` errado — é `sha256(<id da conta>)`, não o nome nem um uuid.                                                                        |

## Referências de código

- `apps/msgops-api/src/lib/web-push-sw.ts` — `buildWebPush`, `buildPlatformServiceWorker`, `buildTracker`
- `apps/msgops-api/src/modules/accounts/web-push-public.controller.ts` — rotas públicas
- `apps/msgops-api/src/modules/admin-integrations/fcm/` — controller, service e DTO do save
- `apps/msgops-api/src/assets/push/` — templates versionados
