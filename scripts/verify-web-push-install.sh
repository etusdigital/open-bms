#!/bin/bash
# Checks a customer site's web-push installation from the outside.
#
# Web push needs two artifacts on the customer side, and half an install fails
# silently: the site simply never captures a subscription, and nothing in the
# BMS says so. This runs the acceptance checklist over HTTP so the answer is one
# command instead of a browser session.
#
# Checks:
#   1. <site>/sw.js responds 200 with a JavaScript content-type
#   2. it lives at the ROOT (a redirect into a subpath is a failure — service
#      worker scope does not climb directories)
#   3. it importScripts() a BMS /bms/push/<accountHash>.js URL
#   4. that accountHash is the expected account (when --account is given)
#   5. the worker URL it points at actually resolves
#   6. the page carries the snippet: bmsTrkOptions, the same accountHash, and
#      bmstrk.js (when a page URL is given)
#
# Usage:
#   verify-web-push-install.sh <site-url> [--account <id>] [--page <url>]
#
#   verify-web-push-install.sh https://site.example.com
#   verify-web-push-install.sh https://site.example.com --account 2
#   verify-web-push-install.sh https://site.example.com --account 2 --page https://site.example.com/noticias
#
# Exit: 0 all checks passed, 1 something failed, 2 bad usage.
# Requires: bash, curl, and sha256sum (Linux) or shasum (macOS).

set -uo pipefail

sha256_hex() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum | cut -d' ' -f1
  else
    shasum -a 256 | cut -d' ' -f1
  fi
}

SITE=""
ACCOUNT_ID=""
PAGE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --account)
      ACCOUNT_ID="${2:-}"
      shift 2
      ;;
    --page)
      PAGE="${2:-}"
      shift 2
      ;;
    -h | --help)
      sed -n '2,30p' "$0"
      exit 0
      ;;
    *)
      if [[ -z "$SITE" ]]; then SITE="$1"; else
        echo "argumento inesperado: $1" >&2
        exit 2
      fi
      shift
      ;;
  esac
done

if [[ -z "$SITE" ]]; then
  echo "uso: $(basename "$0") <site-url> [--account <id>] [--page <url>]" >&2
  exit 2
fi

SITE="${SITE%/}"
SW_URL="$SITE/sw.js"
FALHAS=0

TMPD="$(mktemp -d)"
trap 'rm -rf "$TMPD"' EXIT

ok() { printf '  \033[32mok\033[0m    %s\n' "$1"; }
falha() {
  printf '  \033[31mfalha\033[0m %s\n' "$1"
  FALHAS=$((FALHAS + 1))
}
aviso() { printf '  \033[33maviso\033[0m %s\n' "$1"; }

echo "Verificando $SITE"
echo

# --- 1/2. o arquivo na raiz ------------------------------------------------
echo "sw.js na raiz"

# -L para seguir redirect, mas guardamos a URL final para detectar movimento.
RESP="$(curl -sS -L -o "$TMPD/sw.js" -w '%{http_code}\t%{content_type}\t%{url_effective}' "$SW_URL" 2>/dev/null)"
CODIGO="$(cut -f1 <<<"$RESP")"
TIPO="$(cut -f2 <<<"$RESP" | cut -d';' -f1)"
URL_FINAL="$(cut -f3 <<<"$RESP")"
CORPO="$(cat "$TMPD/sw.js" 2>/dev/null)"

if [[ "$CODIGO" == "200" ]]; then
  ok "$SW_URL responde 200"
else
  falha "$SW_URL respondeu $CODIGO"
  echo
  echo "$FALHAS falha(s) — o resto da verificação depende deste arquivo."
  exit 1
fi

case "$TIPO" in
  application/javascript | text/javascript | application/x-javascript)
    ok "content-type $TIPO"
    ;;
  *)
    falha "content-type $TIPO — o navegador recusa registrar um worker que não é servido como JavaScript"
    ;;
esac

if [[ "$URL_FINAL" != "$SW_URL" ]]; then
  falha "redirecionado para $URL_FINAL — o escopo do service worker não sobe de diretório, o arquivo tem que responder na raiz"
else
  ok "sem redirecionamento — está na raiz"
fi

# --- 3/4/5. para onde o shim aponta ----------------------------------------
echo
echo "destino do importScripts"

WORKER_URL="$(grep -oE 'importScripts\(["'"'"']([^"'"'"']+)' <<<"$CORPO" | head -1 | sed -E 's/.*["'"'"']//')"

if [[ -z "$WORKER_URL" ]]; then
  falha "não achei um importScripts() no arquivo — ele deveria ser um shim de duas linhas"
else
  ok "importScripts para $WORKER_URL"

  HASH_ENCONTRADO="$(grep -oE '/bms/push/[a-f0-9]{64}\.js' <<<"$WORKER_URL" | grep -oE '[a-f0-9]{64}')"
  if [[ -z "$HASH_ENCONTRADO" ]]; then
    falha "a URL não tem o formato /bms/push/<accountHash>.js"
  else
    if [[ -n "$ACCOUNT_ID" ]]; then
      HASH_ESPERADO="$(printf '%s' "$ACCOUNT_ID" | sha256_hex)"
      if [[ "$HASH_ENCONTRADO" == "$HASH_ESPERADO" ]]; then
        ok "accountHash confere com a conta $ACCOUNT_ID"
      else
        falha "accountHash é de outra conta (esperado para $ACCOUNT_ID: $HASH_ESPERADO)"
      fi
    else
      aviso "accountHash não conferido — passe --account <id> para validar"
    fi
  fi

  CODIGO_WORKER="$(curl -sS -o /dev/null -w '%{http_code}' "$WORKER_URL" 2>/dev/null)"
  if [[ "$CODIGO_WORKER" == "200" ]]; then
    ok "o worker no BMS responde 200"
  else
    falha "o worker no BMS respondeu $CODIGO_WORKER — o shim aponta para um arquivo que não existe"
  fi
fi

# --- 6. o snippet na página ------------------------------------------------
echo
echo "snippet na página"

if [[ -z "$PAGE" ]]; then
  aviso "não verificado — passe --page <url> com uma página onde o push deve ser oferecido"
else
  HTML="$(curl -sS -L "$PAGE" 2>/dev/null)"
  # Comentado ou texto solto não conta: um snippet velho deixado em <!-- --> não
  # registra nada, mas bateria em qualquer checagem por substring simples. Junta
  # tudo numa linha (bash puro, sem depender de sed multi-line) para o strip de
  # comentário cruzar quebras de linha.
  HTML_1L="${HTML//$'\n'/$'\x01'}"
  HTML_1L="$(sed -E 's/<!--.*-->//g' <<<"$HTML_1L")"
  HTML_LIMPO="${HTML_1L//$'\x01'/$'\n'}"

  if grep -qE 'bmsTrkOptions[[:space:]]*=[[:space:]]*\{' <<<"$HTML_LIMPO"; then
    ok "bmsTrkOptions presente"

    if grep -qE '<script[^>]+src=["'"'"'][^"'"'"']*bmstrk\.js' <<<"$HTML_LIMPO"; then
      ok "bmstrk.js carregado"
    else
      falha "bmstrk.js não é carregado na página"
    fi

    # Bloco de configuração isolado: o hash tem que estar DENTRO do objeto
    # bmsTrkOptions, não em qualquer lugar do documento — senão um hash de outra
    # conta perdido no HTML (comentário removido acima já cobre o caso óbvio,
    # isto cobre o resto) passaria como coincidência.
    BLOCO_CONFIG="$(awk '/bmsTrkOptions[[:space:]]*=[[:space:]]*\{/{f=1} f{print} f&&/\}/{exit}' <<<"$HTML_LIMPO")"

    # Só compara o hash quando há snippet: numa página sem snippet a divergência
    # é consequência da ausência, e reportá-la sugeriria conta errada.
    if [[ -n "${HASH_ENCONTRADO:-}" ]]; then
      if grep -q "$HASH_ENCONTRADO" <<<"$BLOCO_CONFIG"; then
        ok "accountHash da página bate com o do sw.js"
      else
        falha "o accountHash da página diverge do que está no sw.js — são contas diferentes"
      fi
    fi
  else
    falha "bmsTrkOptions ausente — sem o snippet nada registra, por mais correto que o sw.js esteja"
  fi
fi

echo
if [[ "$FALHAS" -eq 0 ]]; then
  echo "tudo certo."
  exit 0
fi
echo "$FALHAS verificação(ões) falharam."
exit 1
