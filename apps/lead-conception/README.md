# MsgOps Service Lead Conception

Serviço responsável por receber o lead e seu atual funil

Mensagem que ele deve receber no body do evento:

```json
{
  "contact": {
    "email": "filipe@brius.com.br",
    "firstName": "Filipe",
    "lastName": "Braganca",
    "isValid": "true",
    "customFields": {
      "renda": "Mais de 2000",
      "negativado": "false"
    },
    "devices": [
        {
            "token": "asdfa121231h1h123ah123h",
            "type": "web-push",
            "ip": "127.0.0.1",
            "os": "mac os",
            "browser": "chrome",
            "resolution": "1280x900",
            "subscriptionUrl": "https://plusdin.com.br"
        }
    ]
  },
  "apiKey": "asdafsdfaadsfasdf",
  "tagName": "mejores-fluxo-unico-cc"
}
```

Corpo do PubSub: POST

```json
{
  "message": {
    "attributes": {
      "key": "value"
    },
    "data": "ewogICJjb250YWN0IjogewogICAgImVtYWlsIjogImZpbGlwZUBicml1cy5jb20uYnIiLAogICAgImZpcnN0TmFtZSI6ICJGaWxpcGUiLAogICAgImxhc3ROYW1lIjogIkJyYWdhbmNhIiwKICAgICJpc1ZhbGlkIjogInRydWUiLAogICAgImN1c3RvbUZpZWxkcyI6IHsKICAgICAgInJlbmRhIjogIk1haXMgZGUgMjAwMCIsCiAgICAgICJuZWdhdGl2YWRvIjogImZhbHNlIgogICAgfSwKICAgICJkZXZpY2VzIjogWwogICAgICAgIHsKICAgICAgICAgICAgInRva2VuIjogImFzZGZhMTIxMjMxaDFoMTIzYWgxMjNoIiwKICAgICAgICAgICAgInR5cGUiOiAid2ViLXB1c2giLAogICAgICAgICAgICAiaXAiOiAiMTI3LjAuMC4xIiwKICAgICAgICAgICAgIm9zIjogIm1hYyBvcyIsCiAgICAgICAgICAgICJicm93c2VyIjogImNocm9tZSIsCiAgICAgICAgICAgICJyZXNvbHV0aW9uIjogIjEyODB4OTAwIiwKICAgICAgICAgICAgInN1YnNjcmlwdGlvblVybCI6ICJodHRwczovL3BsdXNkaW4uY29tLmJyIgogICAgICAgIH0KICAgIF0KICB9LAogICJhcGlLZXkiOiAiYXNkYWZzZGZhYWRzZmFzZGYiLAogICJ0YWdOYW1lIjogIm1lam9yZXMtZmx1eG8tdW5pY28tY2MiCn0=",
    "messageId": "1637775044677",
    "message_id": "1637775044677",
    "publishTime": "2021-11-23T19:13:55.749Z",
    "publish_time": "2021-11-23T19:13:55.749Z"
  },
  "subscription": "projects/myproject/subscriptions/mysubscription"
}
```

POST

curl -d '{ "message": { "attributes": { "key": "value" }, "data": "eyAibmFtZSI6ICJKb25hdGhhbiAyIiB9IA==", "messageId": "2070443601311540", "message_id": "2070443601311540", "publishTime": "2021-06-10T13:13:13.133Z", "publish_time": "2021-06-10T13:13:13.133Z" }, "subscription": "projects/myproject/subscriptions/mysubscription"}' -H "Content-Type: application/json" -X POST https://msgops-lead-conception-p6tcfyf7qa-ue.a.run.app/

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Google Cloud SDK

Follow the link [Deb/Ubuntu](https://cloud.google.com/sdk/docs/install#deb)

## Docker

Star using Dokerfile only:

docker build . -t msgops-lead-conception-teste:0.1

To start our app, write the following command in your terminal:

```bash
$ docker-compose up dev
```

This will start it in development mode. We even get a file watcher when saving our files so we don't have to re-run it every time we make change.

Start our app in production mode

```bash
$ docker-compose up prod
```

P.S: If you want to ditch the terminal logging, you can run the container in a separate daemon using the -d flag like so:

```bash
$ docker-compose up -d prod
```

### GPC Cloud Run

gcloud builds submit --tag gcr.io/etus-media-development-staging/msgops-service-lead-conception-prod

gcloud beta run deploy msgops-service-lead-conception --image gcr.io/etus-media-development-staging/msgops-service-lead-conception-prod --port 3000 --region us-east1 --set-env-vars TOPIC_NAME_MESSAGE_TRIGGER='msgops.message.trigger'

## Stay in touch

- Author - [Kamil Myśliwiec](https://kamilmysliwiec.com)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](LICENSE).

msgops-service-lead-conception

### PubSub

msgops.lead.conception

Subscription details

projects/etus-media-development-staging/topics/msgops.lead.conception
projects/etus-media-development-staging/subscriptions/msgops.lead.conception-sub

msgops-service-message-trigger
Serviço responsável por preparar o disparo teoricamente programando o disparo para determinado horário com base nos steps
https://gitlab.com/etus/dti/msgops/msgops-service-message-trigger

msgops-service-send-email
Serviço responsavel por processar o email preenchendo as informações necessárias e realizando o disparo para o sendgrid no nosso contexto
https://gitlab.com/etus/dti/msgops/msgops-service-send-email

msgops-service-lead-conception
Serviço responsavel por receber o lead e seu atual funil
https://gitlab.com/etus/dti/msgops/msgops-service-lead-conception

# Examples

1 - Send direct to using GCP topic lead conception.

```json
{
  "contact": {
    "email": "filipe@brius.com.br",
    "firstName": "Filipe",
    "lastName": "Braganca",
    "isValid": "true",
    "customFields": {
      "renda": "Mais de 2000",
      "negativado": "false"
    },
    "devices": [
        {
            "token": "asdfa121231h1h123ah123h",
            "type": "web-push",
            "ip": "127.0.0.1",
            "os": "mac os",
            "browser": "chrome",
            "resolution": "1280x900",
            "subscriptionUrl": "https://plusdin.com.br"
        }
    ]
  },
  "apiKey": "asdfasdfasdfadsf",
  "tagName": "mejores-fluxo-unico-cc"
}
```

1.1 - Include attributes:
automationType = workflow (or retargeting)
![Image_2021-12-07_at_10.32.53_AM](/uploads/41bf186a484e4300baae6e5cb7ac98b0/Image_2021-12-07_at_10.32.53_AM.jpg)
