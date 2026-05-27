# Documentation

This is the entry point to the Open BMS documentation. Start with
**[`getting-started.md`](./getting-started.md)** if you're running the project
for the first time.

## 🚀 Getting started

| Doc                                     | Audience                                            |
| --------------------------------------- | --------------------------------------------------- |
| [Getting started](./getting-started.md) | Anyone running the stack locally for the first time |

## 🚢 Deployment

| Doc                                                  | Audience                                                 |
| ---------------------------------------------------- | -------------------------------------------------------- |
| [Docker Swarm + Portainer](../infra/swarm/DEPLOY.md) | Operators provisioning a production cluster              |
| [Operations runbook](./operations/runbook.md)        | Day-2 operators (migrations, restarts, common incidents) |

The `infra/swarm/` folder also contains the stack files and a working
[`README`](../infra/swarm/README.md) for that deployment target.

## 🛠 Operations

| Doc                                                              | Audience                                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| [Email providers](./operations/email-providers.md)               | Configuring SendGrid, SparkPost, SES, Mailersend, Resend, Mandrill |
| [WhatsApp Cloud (Meta + EvoHub)](./operations/whatsapp-cloud.md) | Setup do Meta App, EvoHub, templates, webhooks, troubleshoot       |
| [GeoIP database (DB-IP / MaxMind)](./operations/geodb.md)        | Setting up GeoIP enrichment and the monthly refresh                |

## 📚 Reference

| Doc                                                           | Audience                           |
| ------------------------------------------------------------- | ---------------------------------- |
| [ClickHouse schema](./reference/clickhouse-schema.md)         | Anyone querying analytics directly |
| [Health-check endpoint](./reference/health-check-endpoint.md) | Integrators, monitoring tooling    |

## 👥 Contributing

- [Contributing guide](../CONTRIBUTING.md) — workflow, conventions, review checklist
- [Code of Conduct](../CODE_OF_CONDUCT.md)
- [Security policy](../SECURITY.md) — how to report vulnerabilities privately
- [Trademark policy](../TRADEMARKS.md)

---

Missing something? Open a documentation issue using the
[Feature request template](https://github.com/etusdigital/open-bms/issues/new?template=feature_request.yml).
