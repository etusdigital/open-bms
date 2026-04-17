# MsgOps Service Message Trigger

Serviço responsável por receber o lead e seu atual funil

Mensagem que ele deve receber no body do evento:

```json
{
  "contact": {
    "email": "jonathan.shun@brius.com.br",
    "firstName": "Jonathan Cruz",
    "phone": "31973650997"
  },
  "audit": "fluxo-emp-pessoal",
  "startDate": 1623360747540
}
```

Corpo do PubSub: POST

```json
{
  "message": {
    "attributes": {
      "key": "value"
    },
    "data": "ewogICAgImNvbnRhY3QiOiB7CiAgICAgICAgImVtYWlsIjogImpvbmF0aGFuLnNodW5AYnJpdXMuY29tLmJyIiwKICAgICAgICAiZmlyc3ROYW1lIjogIkpvbmF0aGFuIENydXoiLAogICAgICAgICJwaG9uZSI6ICIzMTk3MzY1MDk5NyIKICAgIH0sIAogICAgImF1ZGl0IjogImZsdXhvLWVtcC1wZXNzb2FsIiwKICAgICJzdGFydERhdGUiOiAxNjIzMzYwNzQ3NTQwCn0=",
    "messageId": "2070443601311540",
    "message_id": "2070443601311540",
    "publishTime": "2021-02-26T19:13:55.749Z",
    "publish_time": "2021-02-26T19:13:55.749Z"
  },
  "subscription": "projects/myproject/subscriptions/mysubscription"
}
```

POST

curl -d '{ "message": { "attributes": { "key": "value" }, "data": "ewogICJpZCI6ICJjY2Y5MDdmZC1iYzgzLTQyYTYtYjRkMy05MDc0MDkxMGVkYTgiLAogICJjb250YWN0IjogewogICAgImVtYWlsIjogImpvbmF0aGFuLnNodW5AYnJpdXMuY29tLmJyIiwKICAgICJmaXJzdE5hbWUiOiAiSm9uYXRoYW4gQ3J1eiIsCiAgICAicGhvbmUiOiAiMzE5NzM2NTA5OTciLAogICAgImdydXBvIjogImdydXBvOCIsCiAgICAiYmVuZWZpY2lvIjogImJlbmVmaWNpbzgiLAogICAgInJlbmRhIjogInJlbmRhMyIKICB9LAogICJsaXN0SWQiOiAibGlzdElkLXNodW4tdGVzdDgiLAogICJjcmVhdGVkQXQiOiAxNjIzOTM4OTAzMTE3LAogICJ3b3JrZmxvdyI6IHsKICAgICJpZCI6ICJ3b3JrZmxvdy1zaHVuLXRlc3Q4IiwKICAgICJ0eXBlIjogInJldGFyZ2V0aW5nIiwKICAgICJhY3RpdmVTdGVwIjogewogICAgICAicG9zdGlvbiI6ICIwIiwKICAgICAgImlkIjogIndvcmtmbG93LXNodW4tdGVzdDgtc3RlcDEiLAogICAgICAidHlwZSI6ICJlbWFpbCIsCiAgICAgICJjb25maWciOiB7CiAgICAgICAgImlwcG9vbCI6ICJzdHJpbmciLAogICAgICAgICJzdWJqZWN0IjogInN0cmluZyIsCiAgICAgICAgImxvY2F0aW9uIjogewogICAgICAgICAgImJ1Y2tldE5hbWUiOiAic3RyaW5nIiwKICAgICAgICAgICJmaWxlTmFtZSI6ICJzdHJpbmciCiAgICAgICAgfSwKICAgICAgICAiZnJvbSI6IHsKICAgICAgICAgICJmaXJzdE5hbWUiOiAic3RyaW5nIiwKICAgICAgICAgICJlbWFpbCI6ICJzdHJpbmciCiAgICAgICAgfSwKICAgICAgICAidG8iOiB7CiAgICAgICAgICAiZmlyc3ROYW1lIjogIkpvbmF0aGFuIENydXoiLAogICAgICAgICAgImVtYWlsIjogImpvbmF0aGFuLnNodW5AYnJpdXMuY29tLmJyIgogICAgICAgIH0KICAgICAgfQogICAgfSwKICAgICJzdGVwcyI6IFsKICAgICAgewogICAgICAgICJwb3N0aW9uIjogIjAiLAogICAgICAgICJpZCI6ICJ3b3JrZmxvdy1zaHVuLXRlc3Q4LXN0ZXAxIiwKICAgICAgICAidHlwZSI6ICJlbWFpbCIsCiAgICAgICAgImNvbmZpZyI6IHsKICAgICAgICAgICJpcHBvb2wiOiAic3RyaW5nIiwKICAgICAgICAgICJzdWJqZWN0IjogInN0cmluZyIsCiAgICAgICAgICAibG9jYXRpb24iOiB7CiAgICAgICAgICAgICJidWNrZXROYW1lIjogInN0cmluZyIsCiAgICAgICAgICAgICJmaWxlTmFtZSI6ICJzdHJpbmciCiAgICAgICAgICB9LAogICAgICAgICAgImZyb20iOiB7CiAgICAgICAgICAgICJmaXJzdE5hbWUiOiAic3RyaW5nIiwKICAgICAgICAgICAgImVtYWlsIjogInN0cmluZyIKICAgICAgICAgIH0sCiAgICAgICAgICAidG8iOiB7CiAgICAgICAgICAgICJmaXJzdE5hbWUiOiAic3RyaW5nIiwKICAgICAgICAgICAgImVtYWlsIjogInN0cmluZyIKICAgICAgICAgIH0KICAgICAgICB9CiAgICAgIH0sCiAgICAgIHsKICAgICAgICAicG9zdGlvbiI6ICIxIiwKICAgICAgICAiaWQiOiAid29ya2Zsb3ctc2h1bi10ZXN0OC1zdGVwMiIsCiAgICAgICAgInR5cGUiOiAiZW5kIiwKICAgICAgICAiY29uZmlnIjoge30KICAgICAgfQogICAgXQogIH0sCiAgInN0YXJ0ZWRBdCI6IDE2MjM5Mzg5MTA5OTAsCiAgImFjdGl2ZVN0ZXBJZCI6ICJ3b3JrZmxvdy1zaHVuLXRlc3Q4LXN0ZXAxIgp9", "messageId": "2070443601311540", "message_id": "2070443601311540", "publishTime": "2021-06-10T13:13:13.133Z", "publish_time": "2021-06-10T13:13:13.133Z" }, "subscription": "projects/myproject/subscriptions/mysubscription"}' -H "Content-Type: application/json" -X POST https://msgops-message-trigger-p6tcfyf7qa-ue.a.run.app/

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Requirements

- Node.js 24.1.0 or higher
- pnpm 9.x or higher
- Redis 6+

## Installation

```bash
$ pnpm install
```

## Running the app

```bash
# development
$ pnpm start

# watch mode
$ pnpm start:dev

# production mode
$ pnpm start:prod
```

## Test

```bash
# unit tests
$ pnpm test

# e2e tests
$ pnpm test:e2e

# test coverage
$ pnpm test:cov
```

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Google Cloud SDK

Follow the link [Deb/Ubuntu](https://cloud.google.com/sdk/docs/install#deb)

## Docker

Star using Dokerfile only:

docker build . -t msgops-message-trigger-teste:0.1

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

gcloud builds submit --tag gcr.io/etus-media-development-staging/msgops-message-trigger-prod

gcloud beta run deploy msgops-message-trigger --image gcr.io/etus-media-development-staging/msgops-message-trigger-prod --port 3000 --region us-east1 --set-env-vars TOPIC_NAME_MESSAGE_TRIGGER='msgops.message.trigger',TOPIC_NAME_SEND_EMAIL='msgops.send.email',TOPIC_NAME_STORAGE='msg-ops-lead-state-storage'

## Stay in touch

- Author - [Kamil Myśliwiec](https://kamilmysliwiec.com)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## Example

```json
{
  "id": "19f907fd-bc83-42a6-b4d3-90740910eda9",
  "contact": {
    "email": "jonathan.shun@brius.com.br",
    "firstName": "Jonathan Cruz",
    "phone": "31973650997",
    "grupo": "grupo3",
    "beneficio": "beneficio9",
    "renda": "renda3"
  },
  "tagName": "tag-shun-test9",
  "createdAt": 1623938903117,
  "automation": {
    "id": "automation-shun-test9",
    "type": "retargeting",
    "activeStep": {
      "postion": "1",
      "id": "automation-shun-test9-step2",
      "type": "end",
      "config": {}
    },
    "steps": [
      {
        "postion": "0",
        "id": "automation-shun-test9-step1",
        "type": "email",
        "config": {
          "ippool": "string",
          "subject": "string",
          "location": {
            "bucketName": "string",
            "fileName": "string"
          },
          "from": {
            "firstName": "string",
            "email": "string"
          },
          "to": {
            "firstName": "string",
            "email": "string"
          }
        }
      },
      {
        "postion": "1",
        "id": "automation-shun-test9-step2",
        "type": "end",
        "config": {}
      }
    ]
  },
  "startedAt": 1623938910990,
  "activeStepId": "automation-shun-test9-step2"
}
```

## Logs

### Staging

Pub/Sub

https://console.cloud.google.com/cloudpubsub/topic/detail/msgops.message.trigger?project=etus-media-development-staging

Cloud Run

https://console.cloud.google.com/logs/query;query=resource.type%20%3D%20%22cloud_run_revision%22%0Aresource.labels.service_name%20%3D%20%22msgops-message-trigger%22%0Aresource.labels.location%20%3D%20%22us-east1%22%0A%20severity%3E%3DDEFAULT;cursorTimestamp=2021-06-18T01:02:47.488626Z?project=etus-media-development-staging

Storage
https://console.cloud.google.com/datastore/entities;kind=leads-state;ns=msg-ops/query/kind?authuser=0&cloudshell=false&project=etus-media-development-staging
