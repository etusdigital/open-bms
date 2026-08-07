# Web Push (Firebase Cloud Messaging)

Como apontar o web push de uma instalação do BMS para um projeto Firebase próprio.

Existe **um** projeto Firebase por instalação, compartilhado por todas as contas. A configuração é global, guardada em `system_config.fcm_settings`. O que varia por conta são apenas as variáveis de conteúdo do push, em `webpush_settings`.

## O que pegar no Firebase Console

Três valores, todos no mesmo projeto. Se o `project_id` não for idêntico nos três, o push falha sem dar erro — é o engano mais comum aqui.

**Service account JSON.** Em Configurações do projeto → Contas de serviço → Gerar nova chave privada. É a única credencial sensível do conjunto: contém a `private_key` que autoriza o envio.

**Firebase web config.** Em Configurações do projeto → Geral → Seus apps → app **Web**. São sete campos (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`, `measurementId`). Se não houver app Web cadastrado, crie um — é ele que produz essa config. Esses valores rodam no navegador do visitante; não são segredo.

**Chave VAPID pública.** Em Configurações do projeto → Cloud Messaging → Certificados push da Web. Se ainda não houver par de chaves, gere ali. A privada nunca sai do Google.

Guarde a service account fora de qualquer working tree de git, para não commitá-la por acidente:

```bash
mkdir -p ~/.bms-secrets && chmod 700 ~/.bms-secrets
mv ~/Downloads/<projeto>-firebase-adminsdk-*.json ~/.bms-secrets/fcm-service-account.json
chmod 600 ~/.bms-secrets/fcm-service-account.json
```

## Configurar

Não há env var para essas credenciais: tudo vive na Super Admin UI e é persistido em `system_config`.

Logue como super-admin, vá em **Integrações → FCM** e preencha os três campos. No campo de web config você pode colar o snippet inteiro que o console mostra — o parser aceita tanto JSON estrito quanto o formato `const firebaseConfig = { ... }`.

> **Salve os três de uma vez.** A troca do `firebaseConfig` exige os seis campos obrigatórios para acontecer; a da chave VAPID não passa por essa checagem. Salvar a config sem o VAPID deixa o `firebaseConfig` já apontando para o projeto novo e a `vapidKey` ainda apontando para a do bundle. O `getToken` cunha contra esse par inconsistente e **não emite erro nenhum** — nada no código barra esse estado.

Ignore o botão **Testar conexão**: ele apenas faz `JSON.parse` no que você colou e devolve o `project_id`. Uma chave revogada, expirada ou de outro projeto passa verde. A primeira validação de verdade acontece quando o worker `send-push` tenta entregar.

## Verificar

Os artefatos são públicos, então basta um `curl`. O `projectId` servido tem que ser o do seu projeto; se ainda aparecer o do bundle, a config não chegou.

```bash
curl -s http://localhost:5001/bms/web-push.js | grep -o "projectId: '[^']*'" | head -1
```

O service worker de uma conta fica em `/bms/push/<accountHash>.js`, onde `accountHash` é o `sha256` do id da conta em hexadecimal:

```bash
curl -s "http://localhost:5001/bms/push/$(printf 1 | sha256sum | cut -d' ' -f1).js" | head -5
```

A chave VAPID aparece no `web-push.js`, mas **não** no service worker. Isso é esperado: o worker recebe só a web config e a URL do tracker, enquanto o VAPID é usado no `getToken`, que roda na página.

Para ver o que ficou persistido, sem despejar a service account no terminal:

```bash
docker exec postgres psql -U postgres -d msgops \
  -c "SELECT jsonb_pretty(value::jsonb - 'serviceAccountJson') FROM system_config WHERE key = 'fcm_settings';"
```

## Como os arquivos são gerados

Nenhum desses arquivos existe em disco. Todos são renderizados a partir de templates versionados em `apps/msgops-api/src/assets/push/`.

| Artefato      | Rota                            | Renderizado por                              |
| ------------- | ------------------------------- | -------------------------------------------- |
| `web-push.js` | `GET /bms/web-push.js`          | `buildWebPush`                               |
| `bmstrk.js`   | `GET /bms/bmstrk.js`            | `buildTracker`                               |
| SW da conta   | `GET /bms/push/:accountHash.js` | `AccountsService.renderAccountServiceWorker` |

Existe ainda um caminho legado que publica um `bms-sw.js` em `{BMS_ASSETS_URL}/bms/bms-sw.js` durante o save do FCM. Ele é opcional: a rota servida é a fonte da verdade, e uma instalação nova não precisa de bucket público nem de CDN. Quando `BMS_ASSETS_URL` não está configurado, essa publicação é ignorada com um warn e o save devolve 200 normalmente.

O que o site do cliente hospeda é um wrapper mínimo que faz `importScripts` da rota acima. O registro do service worker continua same-origin no lado do cliente; o `importScripts` é que cruza a origem.

### Por que a substituição é feita nos literais

O `web-push-core.js` é um bundle vendorado do SDK do Firebase, com um projeto hardcoded dentro. Em vez de placeholders, `buildWebPush` reescreve valor por valor: conhece os literais do bundle e os troca pelos configurados, sempre com as aspas incluídas na busca para não casar substring de outro campo.

Isso poderia parecer mais simples de resolver passando a config pelo snippet da página, mas não funciona. O construtor do `bmsPush` chama `initializeApp(this.firebaseConfig)` num field initializer, que roda antes da linha que aplica o override vindo do snippet. Qualquer valor passado por ali chega tarde demais, e o `getToken` continua cunhando contra o projeto do bundle. Substituir o literal é o único ponto que realmente muda o projeto — e de quebra mantém a config da plataforma fora do HTML que o cliente cola no site.

A troca só acontece quando a config tem os seis campos obrigatórios: `apiKey`, `projectId`, `messagingSenderId`, `appId`, `authDomain` e `storageBucket`. Uma config parcial não substitui nada, de propósito: meia troca deixaria alguns campos apontando para o projeto antigo e outros para o novo, cunhando tokens mortos.

## Acesso super-admin em dev local

Se você perdeu a senha do super-admin da sua instância local, redefina o hash direto no banco. O custo tem que ser 12, que é o usado pelo `LocalAuthProvider`.

```bash
docker exec msgops-api node -e "console.log(require('bcrypt').hashSync('<NOVA_SENHA>',12))"

docker exec postgres psql -U postgres -d msgops \
  -c "UPDATE user_credentials SET password_hash='<HASH>', updated_at=now() WHERE user_id=<ID>;"
```

Se o `UPDATE` devolver `UPDATE 0`, não existe linha de credencial para esse usuário — o upsert de senha pode nunca ter rodado. Nesse caso troque por um `INSERT` em `user_credentials (user_id, password_hash)`. Para descobrir quem é o super-admin:

```bash
docker exec postgres psql -U postgres -d msgops \
  -c "SELECT u.id, u.email, r.name FROM users u JOIN roles r ON r.id = u.global_role_id;"
```

## Problemas comuns

**O `web-push.js` continua servindo o projeto do bundle.** A config está incompleta — faltou algum dos seis campos obrigatórios e a substituição inteira foi pulada. Confira o que foi colado no campo de web config.

**O token é gerado, mas nenhuma notificação chega.** Provavelmente a chave VAPID não foi salva junto com a web config. Salve os três valores de novo.

**O save devolveu 200, mas o `bms-sw.js` no S3 não mudou.** Esperado quando `BMS_ASSETS_URL` não está configurado: a publicação é não-fatal e não afeta o retorno. Só importa se você usa o caminho legado.

**O teste de conexão passa e o envio falha.** O teste não valida a credencial. Olhe os logs do worker `send-push`.

**`ENOENT` ao servir `web-push-core.js` em produção.** Os assets não foram copiados para o `dist/`. Confira a configuração de `assets` no `nest-cli.json` do build.

**O service worker da conta responde 404.** O `accountHash` está errado: é o `sha256` do id numérico da conta, não o nome nem um uuid.

**Os endpoints do `bmstrk.js` apontam para o host errado.** Eles herdam `BMS_PUBLIC_URL`. Em produção essa variável precisa ser o domínio público da instalação.

## Onde olhar no código

- `apps/msgops-api/src/lib/web-push-sw.ts` — `buildWebPush`, `buildPlatformServiceWorker` e `buildTracker`
- `apps/msgops-api/src/modules/accounts/web-push-public.controller.ts` — as rotas públicas
- `apps/msgops-api/src/modules/admin-integrations/fcm/` — controller, service e DTO do save
- `apps/msgops-api/src/assets/push/` — os templates versionados
