# Repro — Sobreposição do campo "Remetente" (EVO-1022)

**Created:** 2026-05-12
**Author:** Análise estática (sem dev server / screenshots)
**Files inspected:**
- `apps/frontend-react/src/features/messages/components/email-content-form.tsx` (linhas 224-302 — wrapper + pool selector + grid Remetente + reply-to)
- `apps/frontend-react/src/features/messages/components/inbox-preview.tsx`

> **Nota crítica:** O ticket relata "campo Remetente sobreposto em viewport pequena" mas a investigação automática **não encontrou overlap óbvio no JSX atual**. Esta análise lista os suspeitos por probabilidade e prescreve um plano de repro manual para localizar a causa.

---

## Estrutura do bloco "Remetente" (raio-X do JSX)

```
<div class="space-y-4">                                            ← linha 225 (root container)
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">              ← linha 227 (form fields ↔ inbox preview)
    <div class="space-y-4">                                        ← linha 229 (coluna esquerda)
      {/* Pool selector — só renderiza se pools.length > 0 */}
      <FormItem>                                                   ← linha 230-256
        <FormLabel>{t('messages.senderAddress')}</FormLabel>
        <SelectTrigger class="w-full">…</SelectTrigger>            ← Select shadcn
      </FormItem>

      {/* Sender Name + Sender Email side by side */}
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">           ← linha 259 ⚠️ ALVO PRINCIPAL
        <FormField fromName />                                      ← linha 260-272
        <FormField fromMail />                                      ← linha 274-286
      </div>

      <FormField replyTo />                                         ← linha 290-302
      <FormField subject />                                         ← linha 305-360
      <FormField previewText />                                     ← linha 363-417
    </div>

    <div>                                                           ← linha 421-423
      <InboxPreview />                                              ← coluna direita
    </div>
  </div>
  …
</div>
```

**Breakpoints relevantes (Tailwind default):**
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px

**Comportamento por viewport (apenas pelas classes):**
- **<640px:** wrapper externo 1 col (form fields stacked), grid interno Remetente 1 col (fromName empilhado em cima de fromMail). `InboxPreview` abaixo dos form fields. Sem 2 colunas ainda → sem espaço lateral apertado.
- **640-767px (sm sem md):** wrapper externo 1 col, **grid interno Remetente passa para 2 colunas** (`sm:grid-cols-2`). `InboxPreview` ainda abaixo. ⚠️ Inputs ficam com ~280-320px (descontando padding do Card pai).
- **768-1023px (md sem lg):** mesmo que sm — wrapper externo continua 1 col, interno continua 2 cols. Espaço mais confortável.
- **≥1024px:** wrapper externo vira 2 colunas (form fields à esquerda, InboxPreview à direita). Grid interno continua 2 cols. Cada input fica com ~250-280px.

---

## Suspeitos por probabilidade

### Suspeito #1 (MAIS PROVÁVEL) — Aperto no breakpoint `sm` (640-767px), label longa estourando

- **Local:** linha 259, `grid-cols-1 gap-4 sm:grid-cols-2`.
- **Hipótese:** em 640-767px, cada coluna tem ~280-320px de largura útil. O `<FormLabel>` do `fromMail` é `messages.senderEmail` ("Email do remetente" / "Sender Email" — após rename). Se o label for longo OU se houver mensagem de erro Zod ("Endereço de e-mail inválido"), pode ocorrer wrapping inesperado, e o **gap visual entre as duas colunas (gap-4 = 16px) pode dar a impressão de "elementos sobrepostos"**.
- **Sintoma esperado:** label do segundo campo quebra em 2 linhas; primeiro campo segue 1 linha; alturas dos FormItems ficam desbalanceadas; o `<FormMessage>` (erro) do campo invalida e empurra o `replyTo` abaixo pra colidir visualmente.
- **Validação manual:** abrir Chrome DevTools, modo responsivo em 640px, 700px, 767px. Forçar erro Zod no `fromMail` digitando "abc" → ver se a label do email quebra e se algum elemento toca outro.

### Suspeito #2 — `InboxPreview` cobrindo form fields em viewport intermediário

- **Local:** linha 227 (wrapper externo) `grid-cols-1 gap-6 lg:grid-cols-2`.
- **Hipótese:** entre `sm` e `lg` (640-1023px), o `InboxPreview` fica empilhado abaixo dos form fields. Se o `gap-6` (24px) não for suficiente e o `<div class="space-y-3">` interno do InboxPreview tem altura própria, **NÃO há sobreposição CSS real** — só percepção de "tudo amontoado" em telas pequenas.
- **Validação manual:** abrir em 768px e ver a distância entre o último form field (previewText) e o título "Preview da inbox" do InboxPreview.

### Suspeito #3 — Pool selector `SelectContent` (dropdown aberto) cobrindo o grid Remetente

- **Local:** linha 244, `<SelectContent>` do shadcn.
- **Hipótese:** quando o usuário abre o Select de pool, o `SelectContent` renderiza num portal/popover absoluto. Por padrão, shadcn renderiza embaixo do trigger; se o viewport for muito pequeno, o portal pode se ajustar (`side="top"` automático) e cobrir o grid Remetente acima do trigger — porém aqui o trigger é o item mais alto da coluna, então só "cobre" para baixo. ⚠️ Mas se a viewport é vertical curta (ex.: 320×400 landscape mobile), pode haver clipping.
- **Validação manual:** abrir Select de pool em 320×400 landscape. Verificar se o dropdown corta os campos `fromName`/`fromMail` abaixo.

### Suspeito #4 — Sticky/fixed elements globais do layout

- **Local:** fora do `email-content-form.tsx`. Provavelmente `app-layout.tsx` / sidebar / header.
- **Hipótese:** algum header sticky ou sidebar colapsada em mobile cobre o início do bloco. Por exemplo, em 320px, se o app tem um header fixo de 56px e o usuário scrolla, o pool selector pode ficar "abaixo" do header parcialmente.
- **Validação manual:** scrollar até o bloco em 320px e ver se o pool selector / fromName ficam embaixo do app header.

### Suspeito #5 — Margin/padding negativo no `<Card>` (Card pai herdado de `message-form.tsx`)

- **Local:** `apps/frontend-react/src/features/messages/message-form.tsx:287-305`, `<Card><CardContent>` envolvendo `EmailContentForm`.
- **Hipótese:** padrão shadcn `<CardContent>` tem `p-6 pt-0`. Em mobile, o `p-6` (24px) já reduz a largura útil. Combinado com `gap-4` do grid interno, pode ser apertado. **Sem overlap real, só "feel".**

### Suspeito #6 — `previewText` Input com botões absolutos cobrindo o input

- **Local:** linha 380-412 — botões emoji/merge-fields em `top-1/2 right-1 flex -translate-y-1/2`.
- **Hipótese:** **Não é o Remetente** — é o campo Preview Text. Mas se o usuário descreveu "sobreposição em algo perto do remetente", pode ter confundido. Os botões absolutos (40-50px de largura combinada) sobre o input com `pr-[4.5rem]` (linha 377) — a regra de padding está OK, mas se o input encolhe demais (<200px) pode haver sobreposição texto + botões.

---

## Recomendação para a Task 7 (fix)

**Antes de aplicar fix, EXIGIR uma das duas:**

1. Screenshot do Danilo ou colega marcando o elemento que sobrepõe outro (e em qual viewport).
2. Sessão de repro guiada (Danilo abre o dev server, eu observo logs/comportamento via descrição).

**Se nenhuma das duas for viável**, aplicar fixes preventivos baseados nos 3 suspeitos mais prováveis:

| Suspeito | Fix preventivo | Risco regressão |
|---|---|---|
| #1 (aperto sm) | trocar linha 259 de `sm:grid-cols-2` para `md:grid-cols-2` — empilha até 768px | baixo |
| #1 (label longa) | adicionar `min-w-0` em cada `FormItem` filho do grid | baixíssimo |
| #2 (gap pequeno) | aumentar `gap-6` → `gap-8` no wrapper externo | baixíssimo |
| #6 (preview/subject inputs) | ajustar `pr-[4.5rem]` → `pr-20` (mesmo valor, mais clean) e revisar largura mínima | baixíssimo |

**Heurística preferida:** combinar **fix #1a (`md:grid-cols-2`) + fix #1b (`min-w-0`)** — endereça o caso de aperto e wrapping inesperado simultaneamente, sem regressão desktop.

---

## Plano de repro manual (delegado a Danilo / dev runtime)

1. `pnpm --filter frontend-react dev`
2. Abrir Chrome DevTools → Responsive mode.
3. Capturar screenshot em cada viewport: 320, 375, 414, 480, 640, 700, 767, 768, 900, 1024, 1280.
4. Para cada viewport, executar 3 cenários:
   - (a) `/messages/new` com lista de pools vazia.
   - (b) `/messages/new` com lista de pools ≥ 1, ainda sem selecionar.
   - (c) `/messages/new` com pool selecionado + erro Zod forçado (digitar `abc` em fromMail e submit).
5. Anotar qual elemento sobrepõe qual e em qual viewport.

Anexar resultado neste arquivo abaixo da seção "Repro Real" (a criar).

---

## Repro Real (a preencher após validação manual)

_[vazio até Danilo / equipe rodar o plano acima]_
