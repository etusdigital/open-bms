# MsgOps Service Send Email

Serviço responsável por receber o lead e seu atual funil

Mensagem que ele deve receber no body do evento:

```json
{
  "contact": {
    "email": "string",
    "firstName": "string",
    "phone": "string",
    "grupo": "string",
    "beneficio": "string",
    "renda": "string",
    "audienceName": "string",
    "audienceUrl": "string",
    "hashedEmail": "string",
    "campaignIdAquisicao": "string",
    "utmCampaignAquisicao": "string",
    "recommendationName": "string",
    "recommendationUrl": "string",
    "quizId": "string",
    "utmContent": "string"
  },
  "email": {
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
  },
  "next": {}
}
```

Corpo do PubSub: POST

```json
{
  "message": {
    "attributes": {
      "key": "value"
    },
    "data": "ewogICJjb250YWN0IjogewogICAgImVtYWlsIjogImpvbmF0aGFuLnNodW5AYnJpdXMuY29tLmJyIiwKICAgICJmaXJzdE5hbWUiOiAiSm9uYXRoYW4gQ3J1eiIsCiAgICAicGhvbmUiOiAiMzE5NzM2NTA5OTciCiAgfSwKICAiYXVkaXQiOiAiZmx1eG8tZW1wLXBlc3NvYWwiLAogICJlbWFpbCI6IHsKICAgICJ0byI6ICJqb25hdGhhbi5zaHVuQGJyaXVzLmNvbS5iciIsCiAgICAiZnJvbSI6ICJjb250YXRvQHBlLnBsdXNkaW4uY29tLmJyIiwKICAgICJzdWJqZWN0IjogIlNlbmRpbmcgd2l0aCBNc2dPcHMgU2VydmljZSBTRW5kIEVtYWlsIiwKICAgICJlbWFpbF91cmwiOiAiaHR0cHM6Ly9zdG9yYWdlLmNsb3VkLmdvb2dsZS5jb20vbXNnb3BzLWFzc2V0cy1wcmQuZXR1cy5kaWdpdGFsL3RlbXBsYXRlcy9jYW1wYWlnbl9tZXNzYWdlcy81L3RlbXBsYXRlLnR4dCIKICB9LAogICJzdGFydERhdGUiOiAxNjIzMzYwNzQ3NTQwCn0=",
    "messageId": "1212121212121212",
    "message_id": "1313131313131313",
    "publishTime": "2021-02-26T19:13:55.749Z",
    "publish_time": "2021-02-26T19:13:55.749Z"
  },
  "subscription": "projects/myproject/subscriptions/mysubscription"
}
```

POST

curl -d '{ "message": { "attributes": { "key": "value" }, "data": "ewogICJjb250YWN0IjogewogICAgImVtYWlsIjogImpvbmF0aGFuLnNodW5AYnJpdXMuY29tLmJyIiwKICAgICJmaXJzdE5hbWUiOiAiSm9uYXRoYW4gQ3J1eiIsCiAgICAicGhvbmUiOiAiMzE5NzM2NTA5OTciCiAgfSwKICAiYXVkaXQiOiAiZmx1eG8tZW1wLXBlc3NvYWwiLAogICJlbWFpbCI6IHsKICAgICJ0byI6ICJqb25hdGhhbi5zaHVuQGJyaXVzLmNvbS5iciIsCiAgICAiZnJvbSI6ICJjb250YXRvQHBlLnBsdXNkaW4uY29tLmJyIiwKICAgICJzdWJqZWN0IjogIlNlbmRpbmcgd2l0aCBNc2dPcHMgU2VydmljZSBTRW5kIEVtYWlsIiwKICAgICJlbWFpbF91cmwiOiAiaHR0cHM6Ly9zdG9yYWdlLmNsb3VkLmdvb2dsZS5jb20vbXNnb3BzLWFzc2V0cy1wcmQuZXR1cy5kaWdpdGFsL3RlbXBsYXRlcy9jYW1wYWlnbl9tZXNzYWdlcy81L3RlbXBsYXRlLnR4dCIKICB9LAogICJzdGFydERhdGUiOiAxNjIzMzYwNzQ3NTQwCn0=", "messageId": "2070443601311540", "message_id": "2070443601311540", "publishTime": "2021-06-10T13:13:13.133Z", "publish_time": "2021-06-10T13:13:13.133Z" }, "subscription": "projects/myproject/subscriptions/mysubscription"}' -H "Content-Type: application/json" -X POST https://msgops-service-lead-conception-p6tcfyf7qa-ue.a.run.app/

## Plain Text Email Generation

This service automatically generates a plain text version of emails from the HTML content before sending to SendGrid. This improves email deliverability and accessibility.

### How it works

1. **HTML to Text Conversion**: Uses the `html-to-text` library with a compiled converter (initialized once on module start for performance)
2. **SendGrid Content Array**: Emails are sent with both `text/plain` (index 0) and `text/html` (index 1) as required by SendGrid
3. **Placeholder Preservation**: All SendGrid substitution placeholders (`{{VARIABLE}}`) are preserved in both versions
4. **Link Formatting**: Links are converted to `Link Text [URL]` format in plain text
5. **Unsubscribe Link Sync**: The `[unsubscribe_link]` placeholder is automatically synced between HTML and text versions

### Configuration

The converter is configured in `src/html-to-text/html-to-text.service.ts` with the following settings:

- **Word wrap**: 80 characters (email standard)
- **Hidden elements skipped**: `.preheader`, elements with `display: none` or `visibility: hidden`
- **Images skipped**: Alt text is not included in plain text
- **Tracking pixel removed**: `sendgrid_open_tracking` placeholder is stripped from text version

### Files

- `src/html-to-text/html-to-text.module.ts` - Global NestJS module
- `src/html-to-text/html-to-text.service.ts` - Service with compiled converter

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

gcloud builds submit --tag gcr.io/etus-media-development-staging/msgops-service-send-email-prod

gcloud beta run deploy msgops-service-send-email --image gcr.io/etus-media-development-staging/msgops-service-send-email-prod --port 3000 --region us-east1

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
https://gitlab.com/joohncruz/msgops-service-send-email

msgops-service-lead-conception
Serviço responsavel por receber o lead e seu atual funil
https://gitlab.com/etus/dti/msgops/msgops-service-lead-conception

nest new PROJECT-NAME


### Test send email in Staging

Use this json to convert base64
https://codebeautify.org/json-to-base64-converter

Hashed email
https://www.convertstring.com/pt_PT/Hash/SHA256

```json
{
    "automationType": "email",
    "utmCampaign": "flux-shun-01-dia-01",
    "utmContent": "WARMUP-FLUXO-CC-ANUIDADE",
    "contact": {
        "email": "jonathan.shun@brius.com.br",
        "phone": "",
        "hashedEmail": "5715F26C1AA229C6282110C4FE0796AB78010CE815C339F03340FF27F8B32C7B",
        "firstName": "Jonathan",
        "LastName": "Cruz",
        "audienceName": "warmup-flux-shun",
        "audienceUrl": "/news/warmup-flux-shun"
    },
    "email": {
        "title": "flux-shun-01-dia-01",
        "ippool": "cc_plusdin_com_br",
        "subject": "Revelamos o segredo para conseguir o cartão ideal",
        "location": {
            "bucketName": "msgops-assets-stg.etus.digital",
            "fileName": "templates/automation_messages/127/template.txt"
        },
        "from": {
            "firstName": "Equipe Plusdin",
            "email": "contato@cc.plusdin.com.br"
        },
        "to": {
            "firstName": "Jonathan",
            "email": "jonathan.shun@brius.com.br"
        }
    },
    "next": {
        "pubName": "msgops.message.trigger",
        "data": {
            "id": "13131313-ccf6-44ae-a90f-bd39348c8311",
            "automation": {
                "id": "35",
                "type": "email",
                "title": "flux-shun",
                "activeStep": {
                    "position": 1,
                    "id": "flux-shun-01-dia-01",
                    "type": "timer",
                    "value": "720",
                    "config": {}
                },
                "steps": [
                    {
                        "position": 2,
                        "id": "flux-shun-02",
                        "type": "end",
                        "value": null,
                        "config": {}
                    }
                ]
            },
            "startedAt": 1636407401397,
            "activeStepId": "flux-shun-01-dia-01",
            "contact": {
                "email": "jonathan.shun@brius.com.br",
                "phone": "",
                "hashedEmail": "5715F26C1AA229C6282110C4FE0796AB78010CE815C339F03340FF27F8B32C7B",
                "firstName": "Jonathan",
                "LastName": "Cruz",
                "audienceName": "warmup-flux-shun",
                "audienceUrl": "/news/warmup-flux-shun"
            },
            "listId": "/news/warmup-flux-shun"
        }
    }
}
```

POST: https://msgops-send-email-p6tcfyf7qa-ue.a.run.app

```json
{
    "message": {
        "attributes": {},
        "data": "ewogICAgImF1dG9tYXRpb25UeXBlIjogImVtYWlsIiwKICAgICJ1dG1DYW1wYWlnbiI6ICJmbHV4LXNodW4tMDEtZGlhLTAxIiwKICAgICJ1dG1Db250ZW50IjogIldBUk1VUC1GTFVYTy1DQy1BTlVJREFERSIsCiAgICAiY29udGFjdCI6IHsKICAgICAgICAiZW1haWwiOiAiam9uYXRoYW4uc2h1bkBicml1cy5jb20uYnIiLAogICAgICAgICJwaG9uZSI6ICIiLAogICAgICAgICJoYXNoZWRFbWFpbCI6ICI1NzE1RjI2QzFBQTIyOUM2MjgyMTEwQzRGRTA3OTZBQjc4MDEwQ0U4MTVDMzM5RjAzMzQwRkYyN0Y4QjMyQzdCIiwKICAgICAgICAiZmlyc3ROYW1lIjogIkpvbmF0aGFuIiwKICAgICAgICAiTGFzdE5hbWUiOiAiQ3J1eiIsCiAgICAgICAgImF1ZGllbmNlTmFtZSI6ICJ3YXJtdXAtZmx1eC1zaHVuIiwKICAgICAgICAiYXVkaWVuY2VVcmwiOiAiL25ld3Mvd2FybXVwLWZsdXgtc2h1biIKICAgIH0sCiAgICAiZW1haWwiOiB7CiAgICAgICAgInRpdGxlIjogImZsdXgtc2h1bi0wMS1kaWEtMDEiLAogICAgICAgICJpcHBvb2wiOiAiY2NfcGx1c2Rpbl9jb21fYnIiLAogICAgICAgICJzdWJqZWN0IjogIlJldmVsYW1vcyBvIHNlZ3JlZG8gcGFyYSBjb25zZWd1aXIgbyBjYXJ0w6NvIGlkZWFsIiwKICAgICAgICAibG9jYXRpb24iOiB7CiAgICAgICAgICAgICJidWNrZXROYW1lIjogIm1zZ29wcy1hc3NldHMtc3RnLmV0dXMuZGlnaXRhbCIsCiAgICAgICAgICAgICJmaWxlTmFtZSI6ICJ0ZW1wbGF0ZXMvYXV0b21hdGlvbl9tZXNzYWdlcy8xMjcvdGVtcGxhdGUudHh0IgogICAgICAgIH0sCiAgICAgICAgImZyb20iOiB7CiAgICAgICAgICAgICJmaXJzdE5hbWUiOiAiRXF1aXBlIFBsdXNkaW4iLAogICAgICAgICAgICAiZW1haWwiOiAiY29udGF0b0BjYy5wbHVzZGluLmNvbS5iciIKICAgICAgICB9LAogICAgICAgICJ0byI6IHsKICAgICAgICAgICAgImZpcnN0TmFtZSI6ICJKb25hdGhhbiIsCiAgICAgICAgICAgICJlbWFpbCI6ICJqb25hdGhhbi5zaHVuQGJyaXVzLmNvbS5iciIKICAgICAgICB9CiAgICB9LAogICAgIm5leHQiOiB7CiAgICAgICAgInB1Yk5hbWUiOiAibXNnb3BzLm1lc3NhZ2UudHJpZ2dlciIsCiAgICAgICAgImRhdGEiOiB7CiAgICAgICAgICAgICJpZCI6ICIxMzEzMTMxMy1jY2Y2LTQ0YWUtYTkwZi1iZDM5MzQ4YzgzMTEiLAogICAgICAgICAgICAid29ya2Zsb3ciOiB7CiAgICAgICAgICAgICAgICAiaWQiOiAiMzUiLAogICAgICAgICAgICAgICAgInR5cGUiOiAiZW1haWwiLAogICAgICAgICAgICAgICAgInRpdGxlIjogImZsdXgtc2h1biIsCiAgICAgICAgICAgICAgICAiYWN0aXZlU3RlcCI6IHsKICAgICAgICAgICAgICAgICAgICAicG9zaXRpb24iOiAxLAogICAgICAgICAgICAgICAgICAgICJpZCI6ICJmbHV4LXNodW4tMDEtZGlhLTAxIiwKICAgICAgICAgICAgICAgICAgICAidHlwZSI6ICJ0aW1lciIsCiAgICAgICAgICAgICAgICAgICAgInZhbHVlIjogIjcyMCIsCiAgICAgICAgICAgICAgICAgICAgImNvbmZpZyI6IHt9CiAgICAgICAgICAgICAgICB9LAogICAgICAgICAgICAgICAgInN0ZXBzIjogWwogICAgICAgICAgICAgICAgICAgIHsKICAgICAgICAgICAgICAgICAgICAgICAgInBvc2l0aW9uIjogMiwKICAgICAgICAgICAgICAgICAgICAgICAgImlkIjogImZsdXgtc2h1bi0wMiIsCiAgICAgICAgICAgICAgICAgICAgICAgICJ0eXBlIjogImVuZCIsCiAgICAgICAgICAgICAgICAgICAgICAgICJ2YWx1ZSI6IG51bGwsCiAgICAgICAgICAgICAgICAgICAgICAgICJjb25maWciOiB7fQogICAgICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgIF0KICAgICAgICAgICAgfSwKICAgICAgICAgICAgInN0YXJ0ZWRBdCI6IDE2MzY0MDc0MDEzOTcsCiAgICAgICAgICAgICJhY3RpdmVTdGVwSWQiOiAiZmx1eC1zaHVuLTAxLWRpYS0wMSIsCiAgICAgICAgICAgICJjb250YWN0IjogewogICAgICAgICAgICAgICAgImVtYWlsIjogImpvbmF0aGFuLnNodW5AYnJpdXMuY29tLmJyIiwKICAgICAgICAgICAgICAgICJwaG9uZSI6ICIiLAogICAgICAgICAgICAgICAgImhhc2hlZEVtYWlsIjogIjU3MTVGMjZDMUFBMjI5QzYyODIxMTBDNEZFMDc5NkFCNzgwMTBDRTgxNUMzMzlGMDMzNDBGRjI3RjhCMzJDN0IiLAogICAgICAgICAgICAgICAgImZpcnN0TmFtZSI6ICJKb25hdGhhbiIsCiAgICAgICAgICAgICAgICAiTGFzdE5hbWUiOiAiQ3J1eiIsCiAgICAgICAgICAgICAgICAiYXVkaWVuY2VOYW1lIjogIndhcm11cC1mbHV4LXNodW4iLAogICAgICAgICAgICAgICAgImF1ZGllbmNlVXJsIjogIi9uZXdzL3dhcm11cC1mbHV4LXNodW4iCiAgICAgICAgICAgIH0sCiAgICAgICAgICAgICJsaXN0SWQiOiAiL25ld3Mvd2FybXVwLWZsdXgtc2h1biIKICAgICAgICB9CiAgICB9Cn0=",
        "messageId": "13131313",
        "message_id": "13131313",
        "publishTime": 1636407015742,
        "publish_time": 1636407015742,
    }
    "subscription": "teste_shun_subscription"
}
