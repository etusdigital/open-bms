# Research — GeoDB (Geolocalização IP → Cidade)

Feature slug: `bms-opensource`
Autor: Scroll (scroll-docs agent)
Criado: 2026-04-16
Contexto: descoberto na reunião Davidson+Pet 16/abr como dependência não mapeada do BMS monorepo.

---

## Contexto

- Uso atual Etus: serviço pago contratado que faz match IP → nível de cidade em ~1-2ms de latência (banco local)
- Volume: alto (milhões de eventos/mês de tracking de email)
- Vai rodar em Docker/VPS (não GCP Cloud Run)
- Público: self-hosters open source — precisa de UX razoável pra configurar
- Trade-off aceito pelo Davidson: nível de **estado** em vez de cidade se a opção gratuita for decente

---

## Tabela Comparativa

### Bancos Locais (self-hosted)

| Critério | **MaxMind GeoLite2 City** | **DB-IP Lite City** | **IP2Location LITE DB11** |
|---|---|---|---|
| **Tipo** | Banco local (.mmdb / .csv) | Banco local (.mmdb / .csv) | Banco local (.bin / .csv / .mmdb) |
| **Granularidade** | País, estado, cidade, lat/long, CEP | Continente, país, estado, cidade, lat/long | País, estado, cidade, lat/long, CEP, timezone |
| **Licença** | EULA proprietária MaxMind — free com restrições | CC-BY 4.0 — atribuição obrigatória | Free (pessoal e comercial) com atribuição |
| **Redistribuição** | Proibida embutir no app / imagem Docker | Permitida com atribuição (HTML link) | Permitida 1 cópia com atribuição; updates exigem cadastro individual do usuário |
| **Update frequency** | Semanal/quinzenal (~Tuesdays) | Mensal | Mensal (dia 1) |
| **Tamanho MMDB** | ~51-54 MB (descomprimido) | ~125 MB | ~90 MB (IPv4) |
| **Latência (local)** | < 1ms (mmdb em memória) | < 1ms (mmdb em memória) | < 1ms (bin em memória) |
| **Precisão declarada** | "Considerably less accurate" que paid | Score 77/100 (vs 96 pago) | "Limited accuracy" (LITE) |
| **Distribuição** | Download via API com license key (conta MaxMind obrigatória) | Download direto por URL pública | Download com cadastro gratuito |
| **Docker impact** | +54 MB na imagem (mmdb) | +125 MB na imagem (mmdb) | +90 MB na imagem (mmdb) |
| **Node.js lib** | `maxmind` (258k dl/semana) ou `@maxmind/geoip2-node` (126k dl/semana) | `maxmind` (lê qualquer .mmdb) | `ip2location-nodejs` (oficial) |
| **Caveat crítico** | EULA proíbe redistribuir o banco — não pode embutir na imagem Docker pública | Nenhum bloqueador | Updates precisam de novo cadastro por usuário |

### APIs Remotas

| Critério | **ip-api.com** | **ipinfo.io** | **IPGeolocation.io** |
|---|---|---|---|
| **Tipo** | API remota | API remota + banco baixável | API remota |
| **Granularidade** | País, estado, cidade, lat/long, timezone, ISP | Free: só país/continente. Paid Core+: cidade | País, estado, cidade, lat/long, timezone |
| **Licença free** | **Não comercial** (explícito na doc) | Unlimited calls, mas só país no free | 1.000 req/dia grátis |
| **Custo paid** | Pro: sem limite, HTTPS, uso comercial | Core: USD 49/mês (150k-5M req) | A partir de USD 15/mês |
| **Latência** | ~20-80ms (rede) | ~50-200ms (declarado) | ~20-80ms (rede) |

---

## Recomendação em 3 Tiers

### Tier 1 — Default do BMS: DB-IP Lite City ✅ RECOMENDADO

**Por que:**
- Único candidato sem bloqueador legal para redistribuição em imagem Docker pública (CC-BY 4.0)
- Granularidade cidade + estado + lat/long (atende o caso de uso BMS)
- ~125 MB MMDB, atualização mensal, download público sem cadastro
- Compatível com lib `maxmind` (npm, 258k dl/semana) — padrão de facto pra leitura de `.mmdb` em Node.js
- Self-hoster não precisa criar conta em lugar nenhum

**Configuração recomendada:**
- Embutir o `.mmdb` na imagem Docker OU script de download no `docker-compose`
- Exibir "IP geolocation by [DB-IP.com](https://db-ip.com)" na interface (requisito CC-BY)
- Cron mensal ou hook no startup do container pra refresh

**Código de exemplo:**
```typescript
import maxmind, { CityResponse } from 'maxmind';

const lookup = await maxmind.open<CityResponse>('/data/dbip-city-lite.mmdb');
const result = lookup.get('8.8.8.8');
// result?.city?.names?.en → 'Mountain View'
// result?.subdivisions?.[0]?.names?.en → 'California'
```

### Tier 2 — Opt-in: MaxMind GeoLite2 City

**Por que:** precisão superior e update semanal. Self-hoster traz o próprio banco (mesmo modelo Matomo/Plausible).

**Configuração:**
- Env vars: `MAXMIND_ACCOUNT_ID` + `MAXMIND_LICENSE_KEY`
- Script de download incluso no projeto que baixa se as credenciais estiverem presentes
- Doc: "Para geolocalização por cidade mais precisa, configure sua conta MaxMind GeoLite2 (gratuita)"

### Tier 3 — Feature flag opcional: API remota

**Por que:** self-hosters que não querem gerenciar banco local.

```env
GEO_PROVIDER=api          # 'local' | 'api' | 'disabled'
GEO_API_KEY=...
```

- `ip-api.com` Pro: sem limite declarado, HTTPS, uso comercial liberado
- `ipinfo.io` Core: USD 49/mês
- ⚠️ `ip-api.com` free **NÃO pode ser default** — proibição comercial explícita

---

## Graceful Degradation

```env
GEO_ENRICHMENT_ENABLED=true      # false = desliga tudo, zero chamadas
GEO_PROVIDER=local               # 'local' (padrão) | 'api' | 'disabled'
GEO_DB_PATH=/data/geo.mmdb
GEO_API_KEY=                     # só para provider=api
```

```typescript
async function enrichGeoData(ip: string): Promise<GeoData | null> {
  if (!config.GEO_ENRICHMENT_ENABLED) return null;
  try {
    return await geoLookup(ip) ?? null;
  } catch (err) {
    logger.warn('geo_enrichment_unavailable', { ip, err });
    return null;  // degradação silenciosa — evento continua sendo registrado
  }
}
```

Evento de tracking é registrado normalmente; campos `geo_city`/`geo_region`/`geo_country` ficam `null`. Dashboard mostra "Localização não disponível" em vez de quebrar.

---

## Fontes

- [MaxMind GeoLite2 Free Geolocation Data](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data)
- [DB-IP Lite download](https://db-ip.com/db/download/ip-to-city-lite) | [Licença CC-BY 4.0](https://db-ip.com/db/lite.php)
- [IP2Location LITE DB11](https://lite.ip2location.com/database/db11-ip-country-region-city-latitude-longitude-zipcode-timezone)
- [ip-api.com docs](https://ip-api.com/docs/api:json) | [ipinfo.io pricing](https://ipinfo.io/pricing)
- [node-maxmind GitHub](https://github.com/runk/node-maxmind)

---

## Handoff

Davidson confirma DB-IP Lite como default → `@apex-architect` produz **ADR-2: GeoDB provider architecture** (interface `GeoProvider`, download/refresh strategy, graceful degradation) → Dev B implementa `packages/geo` na Fase 7.7.
