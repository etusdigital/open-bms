# NEWS

## Criando uma campanha

Para criar uma campanha de news foi exposto uma rota chamada `{API_PATH}/news/campaigns` que possui varios metodos HTTP mas vamos falar da criacao o metodo post.

Atualmente para criar uma campanha estamos utilizando o body:

```json CREATE CAMPAIGN
{
  "emailTemplates": [
    {
      "id": 127,
      "title": "shun-teste-email-batch",
      "ippool": "dev_test_mail_only",
      "priority": "normal",
      "subject": "Olá %FIRSTNAME%! 🥶",
      "previewText": null,
      "content": "",
      "text": "",
      "fromMail": "contato@plusdinmail.com.br",
      "fromName": "Plusdin Teste",
      "isTested": true,
      "messageId": null,
      "version": null,
      "templateUrl": "https://storage.cloud.google.com/msgops-assets-stg.etus.digital/templates/automation_messages/127/template.txt",
      "bucketName": "msgops-assets-stg.etus.digital",
      "fileName": "templates/automation_messages/127/template.txt",
      "content_json": null,
      "replyTo": null,
      "createdAt": "2021-10-19T23:21:56.000Z",
      "updatedAt": "2022-01-25T22:51:21.000Z",
      "deletedAt": null,
      "automationMessageAccount": [
        {
          "id": 14,
          "testId": "2021-10-19-20:22:03:132t",
          "providerAccountId": "plusdin",
          "createdAt": "2021-10-19T23:22:01.000Z",
          "updatedAt": "2022-01-25T22:51:37.000Z",
          "deletedAt": null
        },
        {
          "id": 15,
          "testId": "2021-10-19-20:22:03:132t",
          "providerAccountId": "plusdin",
          "createdAt": "2021-10-19T23:22:01.000Z",
          "updatedAt": "2022-01-25T22:51:37.000Z",
          "deletedAt": null
        }
      ],
      "account": {
        "id": 1,
        "name": "Plusdin Test",
        "description": "Plusdin é a nossa conta principal",
        "defaultDomain": "plusdin.com.br",
        "domains": ["plusdin.com", "rlcard.com"],
        "defaultSenderName": "Equipe Plusdin",
        "defaultSenderEmail": "contato@plusdin.com.br",
        "defaultAddress": null,
        "settings": [],
        "sendgridKey": "SG.asdf324123asdf",
        "createdAt": "2022-01-18T01:13:41.000Z",
        "updatedAt": "2022-01-18T01:34:31.000Z",
        "deletedAt": null
      }
    }
  ],
  "title": "shun-teste-balestrin",
  "publisher": "plusdin",
  "scheduleTo": "2022-01-31T14:00:00.000Z",
  "status": 1,
  "tags": ["dev"],
  "audiences": [],
  "contentType": "automation-messages"
}
```

Podemos reparar que emailTemplates é um array para no futuro possibiltiar de forma mais simples (me arrependi disso) trabalhar com multiplos emails em um campanha que é o aconselhavel.

Esta rota este vinculada a pagina `https://{APP_PATH}/news/campaigns/new` caso queria criar a campanha utilizando o frontend.

1- MSGOPS*FRONTEND > MSGOPS_API
1.1 - MSGOPS_API > Salva o email no **BUCKET**
1.2 - MSGOPS_API > Criar o **Cloud Task** para o horario selecionado
1.2.1 - CLOUD TASK > POST `https://{msgops-campaign-trigger}/trigger/shun-teste-balestrin`
1.3 - MSGOPS_API > Salva no **Datastore** *NAMESPACE* msgops *KIND\* campaigns

## Executando a campanha

1- CLOUD TAKS > POST `https://{msgops-campaign-trigger}/trigger/shun-teste-balestrin`
2 - MSGOPS-CAMPAIGN-TRIGGER > Recupera a campanha pelo Id no Datastore
2.1 - MSGOPS-CAMPAIGN-TRIGGER > Encaminha a camapanha para o **PubSub** TOPIC_MSGOPS_CAMPAIGN_PACKER

```json
{
  "contentType": "automation-messages",
  "id": "shun-teste-balestrin",
  "status": 1,
  "createdAt": "2022-01-31T13:28:47.679Z",
  "scheduleTo": "2022-01-31T14:00:00.000Z",
  "tags": ["dev"],
  "deleted": false,
  "emailTemplates": [
    {
      "createdAt": "2021-10-19T23:21:56.000Z",
      "ippool": "dev_test_mail_only",
      "automationMessageAccount": [
        {
          "createdAt": "2021-10-19T23:22:01.000Z",
          "testId": "2021-10-19-20:22:03:132t",
          "providerAccountId": "plusdin",
          "id": 14,
          "updatedAt": "2022-01-25T22:51:37.000Z",
          "deletedAt": null
        },
        {
          "deletedAt": null,
          "id": 15,
          "updatedAt": "2022-01-25T22:51:37.000Z",
          "providerAccountId": "plusdin",
          "createdAt": "2021-10-19T23:22:01.000Z",
          "testId": "2021-10-19-20:22:03:132t"
        }
      ],
      "content": "Saved to bucket only: msgops-assets-stg.etus.digital templates/campaign_messages/shun-teste-balestrin/template.txt",
      "templateUrl": "https://storage.cloud.google.com/msgops-assets-stg.etus.digital/templates/campaign_messages/shun-teste-balestrin/template.txt",
      "title": "shun-teste-email-batch",
      "account": {
        "sendgridKey": "SG.asdf324123asdf",
        "description": "Plusdin é a nossa conta principal",
        "defaultSenderName": "Equipe Plusdin",
        "name": "Plusdin Test",
        "defaultSenderEmail": "contato@plusdin.com.br",
        "defaultDomain": "plusdin.com.br",
        "defaultAddress": null,
        "domains": ["plusdin.com", "rlcard.com"],
        "deletedAt": null,
        "updatedAt": "2022-01-18T01:34:31.000Z",
        "id": 1,
        "createdAt": "2022-01-18T01:13:41.000Z",
        "settings": []
      },
      "replyTo": null,
      "messageId": null,
      "priority": "normal",
      "id": "shun-teste-email-batch",
      "previewText": null,
      "fileName": "templates/campaign_messages/shun-teste-balestrin/template.txt",
      "subject": "Olá %FIRSTNAME%! 🥶",
      "bucketName": "msgops-assets-stg.etus.digital",
      "isTested": true,
      "text": "",
      "version": null,
      "content_json": null,
      "fromMail": "contato@plusdinmail.com.br",
      "updatedAt": "2022-01-25T22:51:21.000Z",
      "fromName": "Plusdin Teste",
      "deletedAt": null
    }
  ],
  "audiences": [],
  "scheduleToCloudTaskId": "projects/etus-media-development-staging/locations/us-east1/queues/message-trigger-timer-teste/tasks/09335258826448268601",
  "title": "shun-teste-balestrin",
  "publisher": "plusdin"
}
```

3 - TOPIC*MSGOPS_CAMPAIGN_PACKER > MSGOPS_CAMPAIGN_PACKER
3.1 - Busca os contatos com base na tag e as audiencias no **Datastore** \_NAMESPACE* msgops*publisher \_KIND* contacts*tags
3.1.1 - É possivel limitar a quantidade de envio com base no env.QUERY_LIMIT_CONTACT caso seja 0 nao terá limite
3.2 - Enriquece os contatos encontrados pela tag no **Datastore** \_NAMESPACE* msgops _KIND_ contacts
3.3 - Enriquece os contatos encontrados pela tag no **Datastore** _NAMESPACE_ msgops _KIND_ contacts
4 - Quebra os contatos em pacotes com base na quantidade estabelecida no env.LIMIT_CONTACT_BATCH
5 - Estes pacotes seram enviados para o topico env.TOPIC_MSGOPS_CAMPAIGN_BATCH_PROCESS (msgops-campaign-batch-process)

### msgops-campaign-packer

    Este cara se conecta a um pubsub e recebe a campanha
    Ele recupera os contatos no datastore com base na audiencia e tag inserida na criacao da campanha
    Agrupa em pacotes isolados de X leads, no caso deve ser 1000, e manda para o pubsub.

        projects/etus-media-development-staging/topics/msgops-campaign-batch-process => PULL
                1...100 = { publisher, campaign_id, contacts, email }

Alguem tem que consumir essa fila...

O trigger sera o CloudScheduler em staging com o nome (msgops-campaign-news-plusdin: https://console.cloud.google.com/cloudscheduler?project=etus-media-development-staging)
Chama essa rota aqui > https://msgops-campaign-trigger-p6tcfyf7qa-ue.a.run.app/queue/plusdin

msgops-campaign-trigger
Queue route: Porteira
Ele a fila msgops-campaign-batch-process e manda pra frente que seria para o msgops-send-batch-email

## Consumindo os pacotes das campanhas

1- Google Scheduler a cada 1 minuto para o endpoint `msgops-campaign-trigger`
2- POST `https://{msgops-campaign-trigger}/queue`
3- Este por si consulta a **subscription** SUB_MSGOPS_CAMPAIGN_BATCH_PROCESS=msgops-campaign-batch-process-sub
4- Apos consumir a mensagem a mesma é direcionada para o TOPIC_MSGOPS_SEND_BATCH_EMAIL=msgops-send-batch-email
5- Este por si so esta conectado ao msgops-send-email
