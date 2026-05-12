# Repro — Bug auto-fill `fromName` / `fromMail` (EVO-1022)

**Created:** 2026-05-12
**Author:** Análise estática (sem dev server)
**Files inspected:**
- `apps/frontend-react/src/features/messages/components/email-content-form.tsx` (linhas 87-95, 98-106, 230-256, 259-287)
- `apps/frontend-react/src/features/messages/message-form.tsx` (linhas 64-67, 381-393)
- `apps/frontend-react/src/features/pools/types.ts`

> **Nota:** Esta repro foi feita por inspeção do código (não por execução do app em dev server). As hipóteses abaixo se baseiam no controle de fluxo do React Hook Form + Select shadcn. Recomenda-se validação manual antes do PR final.

---

## TL;DR

O `handlePoolChange` (linhas 87-95) **só é disparado pelo evento `onValueChange` do `<Select>`** — ou seja, quando o usuário clica e seleciona um pool. **Não existe nenhum efeito que dispare a mesma lógica de prefill quando:**

- o componente monta com um pool já selecionado (edição / duplicação);
- `usePoolsForSelect` resolve depois do mount inicial;
- `ippool` muda programaticamente (deep-link, parent state).

`currentPoolId` (linhas 98-106) apenas controla a UI do Select (qual item aparece como "selected") via `useMemo`, mas **não executa side-effect algum** quando muda.

Resultado: nos cenários acima, o Select exibe o pool correto mas os campos `fromName` / `fromMail` permanecem com o valor persistido ou vazio (não recebem os defaults do pool).

---

## Paths exercitados (análise dos 4 fluxos da tech-spec)

### Fluxo A — Criação de mensagem nova com clique manual no pool

- Rota: `/messages/new`
- `defaultValues` em `message-form.tsx:381-393`: `{ ippool: '', fromName: '', fromMail: '', replyTo: '', ... }`
- `pools` resolve via `usePoolsForSelect`.
- Usuário clica no Select → `<Select onValueChange={handlePoolChange}>` (linha 238) dispara `handlePoolChange(poolId)`.
- `handlePoolChange` faz 4 `setValue` (linhas 90-93).

**Status:** ✅ funciona. AC1 deve passar sem mudanças.

### Fluxo B — Edição de mensagem existente com `ippool` setado

- Rota: `/messages/{id}/edit`
- `defaultValues` recebe a mensagem do back-end (ex.: `{ ippool: 'transactional', fromName: '', fromMail: '', ... }` ou valores que diferem do default atual do pool).
- `useForm` é inicializado em `message-form.tsx:64-67` com esses defaults.
- `EmailContentForm` monta. `pools` resolve via `usePoolsForSelect`.
- `currentPoolId` é calculado (linhas 98-106) buscando por `poolName === 'transactional'` → encontra o pool e devolve `String(pool.id)`.
- Select exibe o pool selecionado. ✅ visual ok.
- **`handlePoolChange` nunca dispara** — não há `useEffect` que detecte "pool resolveu + ippool é o desse pool".
- `fromName` / `fromMail` **permanecem** com os valores persistidos da mensagem (potencialmente vazios ou desatualizados em relação ao default do pool).

**Status:** ❌ **Bug confirmado.** Falha o AC2.

### Fluxo C — Duplicação de mensagem

- Rota presumida: `/messages/new?duplicateFrom={id}` (ou semelhante — não verificado).
- `defaultValues` recebe os valores da mensagem original (inclui `ippool` populado).
- Comportamento idêntico ao Fluxo B: o Select reflete o pool, mas o auto-fill nunca executa.

**Status:** ❌ **Bug confirmado** (mesma raiz).

### Fluxo D — Mudança programática de `currentPoolId`

- Cenário: deep-link com `?poolId=X`, ou parent state que atualiza `ippool` no form via `setValue` externo, ou Reset do form.
- `currentPoolId` recalcula via `useMemo` (linhas 98-106) e o Select atualiza o item selecionado.
- **`handlePoolChange` nunca dispara** — `onValueChange` só é chamado por interação do usuário, não por mudança do `value` prop.
- `fromName` / `fromMail` ficam dessincronizados.

**Status:** ❌ **Bug confirmado.** Falha o AC4.

### Fluxo E — Race condition `pools` chega depois do mount

- Em `/messages/new`, se a renderização inicial acontece antes da resolução do `useQuery` de pools (`usePoolsForSelect`), o bloco do pool selector nem renderiza (`pools.length > 0` na linha 231 é falso).
- Quando `pools` chega, o bloco aparece, mas `ippool` continua `''` → `currentPoolId` é `undefined` → Select mostra placeholder.
- Usuário precisa clicar manualmente. **Sem bug funcional, mas UX inferior** — se houver `isDefault` no pool, faria sentido aplicar auto-fill.

**Status:** ⚠️ Não é bug do ticket, mas é melhoria adjacente (out of scope salvo aprovação).

---

## Diagnóstico — por que o bug existe

**Causa raiz:** `handlePoolChange` está acoplado ao evento de clique do `<Select>`. Não há sincronização "form state → side-effect" para o caso em que `ippool` já vem populado (edição/duplicação) ou muda programaticamente.

**Padrão React Hook Form esperado:** dois caminhos para o mesmo side-effect:

1. **Imperativo (clique):** `onValueChange={handlePoolChange}` — já existe.
2. **Reativo (state change):** `useEffect([currentPoolId, pools], () => { ... })` — falta.

Sem o caminho 2, a UI mostra o pool selecionado mas os campos derivados ficam stale.

---

## Hipótese de correção (preview da Task 6)

```tsx
const applyPoolDefaults = useCallback(
  (pool: Pool, opts: { preserveUserEdits?: boolean } = {}) => {
    const { preserveUserEdits = false } = opts;
    const { dirtyFields } = form.formState;

    form.setValue('ippool', pool.poolName);

    if (!preserveUserEdits || !dirtyFields.fromName) {
      form.setValue('fromName', pool.senderName ?? '');
    }
    if (!preserveUserEdits || !dirtyFields.fromMail) {
      form.setValue('fromMail', pool.senderEmail ?? '');
    }
    if (!preserveUserEdits || !dirtyFields.replyTo) {
      form.setValue('replyTo', pool.senderReplyTo ?? '');
    }
  },
  [form],
);

const handlePoolChange = (poolId: string) => {
  const pool = pools.find((p) => String(p.id) === poolId);
  if (pool) applyPoolDefaults(pool, { preserveUserEdits: false }); // clique = sempre sobrescreve
};

// Sync inicial / programático: prefill apenas quando os campos ainda não foram editados pelo usuário.
useEffect(() => {
  if (!currentPoolId) return;
  const pool = pools.find((p) => String(p.id) === currentPoolId);
  if (!pool) return;
  applyPoolDefaults(pool, { preserveUserEdits: true }); // edição = preserva o que o user já mexeu
}, [currentPoolId, pools, applyPoolDefaults]);
```

### Decisão pendente para o checkpoint (Risco R1 da tech-spec)

- **Clique manual:** `preserveUserEdits=false` (sempre sobrescreve — comportamento atual, intuitivo).
- **Sync programático (edição/mount):** `preserveUserEdits=true` (preserva edições manuais persistidas, ex.: `fromName="Marketing Etus"` que o usuário escreveu antes de salvar).

**Alternativa:** `preserveUserEdits=true` em ambos. Mais conservador, mas menos previsível em criação (usuário troca pool, espera ver o sender do novo pool, e fica vendo o anterior se já editou).

**Recomendação:** clique = overwrite; mount/programático = preserve. Validar com Danilo no checkpoint.

---

## Riscos da correção

- **Loop infinito do `useEffect`:** se `applyPoolDefaults` mudar `ippool` e isso recompute `currentPoolId`, o effect re-dispara. Mitigação: o effect só atua quando `pools.find(p => String(p.id) === currentPoolId)` encontra um pool, e `setValue('ippool', pool.poolName)` é idempotente (mesmo valor → form state inalterado → `currentPoolId` igual → effect não re-dispara). **Validar com React DevTools.**
- **`isDirty` global do form:** chamar `setValue` no mount marca o form como dirty, o que dispara o `UnsavedChangesDialog` em `message-form.tsx:176`. Mitigação: passar `{ shouldDirty: false }` no `setValue` do path "preserveUserEdits" — usar `setValue(name, value, { shouldDirty: false })`.
- **AC3 (preservar edição manual após troca de pool):** o spec define `preserveUserEdits=true` no clique também (AC3). Isso contradiz a recomendação acima. **Confirmar interpretação do AC3 com Danilo:** "ele editou manualmente, então clicou em outro pool" — se a regra é preservar, então `preserveUserEdits=true` no clique também. Se a regra é "trocar pool reseta tudo", AC3 está errado e precisa ser corrigido.

---

## Próximos passos (Fase 1 — não executar agora)

- Task 6 implementa `applyPoolDefaults` + `useEffect` conforme acima.
- Task 10 cria `email-content-form.test.tsx` cobrindo AC1-AC5.
