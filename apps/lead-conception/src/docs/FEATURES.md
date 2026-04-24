# FEATURES

## SPLIT

### Como funciona?

Basta criar uma variavel de ambiente FEATURE_SPLIT_TERM dentro da aba de cloud-run do gcp. Com as seguintes caracteristicas:

**Variavel Pattern:**

Percent:AutomationId:Pool:Sender

**Exemplo:**

5:qh-f24h:flx_plusdin_com_br:contato@flx.plusdin.com.br

Neste caso todos os emails que seram criados no LeadStateMessage receberá o novo pool
