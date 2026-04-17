---
title: "feat: Automation Editor UX Redesign — Fullscreen, Modal Config, Drag-and-Drop Sidebar"
type: feat
status: active
date: 2026-03-23
---

# Automation Editor UX Redesign

## Overview

Redesign the automation editor experience to match modern journey builder UX (Bird-style). Three main changes:

1. **Fullscreen editor with compact top bar** — Replace the current header form with a minimal top bar showing only the automation name, status badge, and an "Edit" button. Clicking "Edit" opens a modal with all metadata fields (name, description, product, target, labels).

2. **Drag-and-drop sidebar** — Replace the "+" button on edges with a persistent left sidebar listing available step types grouped by category. Users drag blocks from the sidebar onto the canvas and connect them manually.

3. **Persist React Flow layout** — Add a `flow_layout` JSONB column to the `automations` table in `msgops-api` to save/restore node positions and edge connections, so the visual layout survives save/reload cycles.

Additionally, fix the **save flow bug** where the parent page serializes stale initial data instead of the editor's live state.

## Problem Statement

The current editor wastes vertical space with an inline title input and has no fields for description, product, target, or labels. The "+" button between edges is the only way to add steps — there's no way to drag, drop, or freely connect nodes. Node positions are not persisted (they're computed from the tree order on every load).

## Proposed Solution

### A. Compact Top Bar (Bird-style)

```
┌──────────────────────────────────────────────────────────────────┐
│ ✕  [Draft] My Automation Name ✏️    Last saved 2 min ago   [Save] │
└──────────────────────────────────────────────────────────────────┘
```

- **Close (✕)** — navigates back to `/automations/emails`
- **Status badge** — "Draft" (inactive) or "Active" (green), clickable to toggle
- **Automation name** — display only, with a pencil icon that opens the metadata modal
- **Last saved** — relative timestamp
- **Save button** — primary action

### B. Metadata Modal

A `Dialog` opened by clicking the pencil icon or "Edit details" button. Fields:

| Field | Control | Source | Notes |
|-------|---------|--------|-------|
| Name (title) | Text input | — | Max 40 chars. Required. |
| Description | Textarea | — | Max 255 chars. Optional. |
| Product (verticalType) | Select | Hardcoded: `cc`, `emp` | Internal accounts only |
| Target | Select | Hardcoded: `open`, `click` | Internal accounts only |
| Labels | Multi-select with search | `GET /labels` | Max 10. Uses existing label hooks. |
| Rate Limit | Switch | — | Internal accounts only |

### C. Drag-and-Drop Sidebar

A persistent right sidebar (matching Bird's UX) with "Building blocks" grouped by category:

```
Building blocks
─────────────────
Actions
  ⊞ Send Email
  ⊞ Send SMS
  ⊞ Send Web Push

Contacts
  ⊞ Add Tag
  ⊞ Remove Tag
  ⊞ Update Field

Timing
  ⊞ Wait

Logic
  ⊞ Condition
  ⊞ Split
  ⊞ End Journey
```

Each item has a drag handle (⊞). Users drag items onto the canvas. React Flow's `onDrop` / `onDragOver` handlers create the node at the drop position. Users then manually connect nodes by dragging from a source handle to a target handle (`nodesConnectable={true}`).

The "+" button on edges is **removed**. The `AddStepEdge` custom edge is replaced with a standard `smoothstep` edge.

### D. Persist Flow Layout

Add a `flow_layout` JSONB column to the `automations` table to store:

```json
{
  "nodes": [
    { "id": "1", "position": { "x": 400, "y": 50 } },
    { "id": "2", "position": { "x": 400, "y": 250 } }
  ],
  "edges": [
    { "id": "e1-2", "source": "1", "target": "2" }
  ],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

This separates **visual layout** (positions, viewport) from **logical structure** (the step tree in `steps`/`triggers` columns). On save, the frontend sends both the step tree (for the existing API) and the flow layout (new field). On load, the frontend uses the flow layout to restore positions instead of computing them from the tree.

**Backward compatibility**: If `flow_layout` is null (automations created by Vue 2 or before this feature), the frontend falls back to auto-layout from the tree.

### E. Fix Save Flow Bug

The current `automation-form-page.tsx` serializes `effectiveNodes`/`effectiveEdges` which are the initial (stale) values, not the live editor state. Fix this by:

- Exposing the editor's live state via a `useImperativeHandle` ref
- The parent calls `editorRef.current.getState()` on save to get current nodes/edges/stepIdCounter

## Technical Approach

### Implementation Tasks

#### Task 1: Backend — Add `flow_layout` column

**Files:**
- `msgops-api/src/entities/automation.entity.ts` — add column
- `msgops-api/src/modules/automations/automation.dto.ts` — add to DTO validation
- Migration file — `ALTER TABLE automations ADD COLUMN flow_layout jsonb DEFAULT NULL`

```typescript
// automation.entity.ts — add:
@Column('jsonb', { name: 'flow_layout', nullable: true })
flowLayout?: Record<string, unknown>;
```

```typescript
// automation.dto.ts — add to Joi schema:
flowLayout: Joi.object().allow(null).optional(),
```

The `stripUnknown: true` on the DTO already drops unknown fields, so the Vue 2 frontend won't be affected — it simply doesn't send `flowLayout`.

#### Task 2: Frontend types — Add flowLayout to types

**Files:**
- `apps/frontend-react/src/features/automations/types.ts` — add `flowLayout` to `Automation`
- `apps/frontend-react/src/features/automations/editor/types.ts` — add `FlowLayout` type, add to `AutomationPayload`

```typescript
// editor/types.ts
export interface FlowLayout {
  nodes: Array<{ id: string; position: { x: number; y: number } }>
  edges: Array<{ id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }>
  viewport?: { x: number; y: number; zoom: number }
}
```

#### Task 3: Redesign top bar — Compact header

**File:** `apps/frontend-react/src/features/automations/automation-form-page.tsx`

Replace the current header with a slim bar:
- Close button (✕ or ← arrow) linking to `/automations/emails`
- Status badge (Draft/Active) — clickable toggle
- Automation name as text (not input), with pencil icon to open modal
- "Last saved X ago" computed from `automation.updatedAt` using `date-fns/formatDistanceToNow`
- Save button (right side)

The page becomes a fullscreen layout: `h-screen flex flex-col` with the top bar as the only chrome above the editor.

#### Task 4: Metadata modal

**File:** `apps/frontend-react/src/features/automations/editor/panels/automation-details-modal.tsx`

A `Dialog` component with the form fields:
- Name — `<Input>` with max 40 chars
- Description — `<Textarea>` with max 255 chars
- Product (verticalType) — `<Select>` with cc/emp options (shown only for internal accounts via `usePermissions` or account check)
- Target — `<Select>` with open/click (internal only)
- Labels — multi-select. Reuse `useLabels` hook from the labels feature to fetch available labels. Render as a `Command` + `Popover` combo (or a simpler checkbox list).
- Rate Limit — `<Switch>` (internal only)

On "Save" inside the modal, update the local form state (don't save to API — only on the main Save button).

#### Task 5: Drag-and-drop sidebar

**File:** `apps/frontend-react/src/features/automations/editor/panels/blocks-sidebar.tsx`

A fixed-width right sidebar (~280px) rendered alongside the React Flow canvas. Contains draggable items grouped by category.

Each item uses the HTML Drag and Drop API:

```typescript
function DraggableBlock({ type, label, icon }: { type: string; label: string; icon: React.ReactNode }) {
  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('application/reactflow', type)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div draggable onDragStart={onDragStart} className="flex items-center gap-2 cursor-grab ...">
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      {icon}
      <span>{label}</span>
    </div>
  )
}
```

Categories for Phase 1:
- **Actions**: Email (more channels in future phases)
- **Timing**: Wait
- **Logic**: End

Phase 2+ will add: SMS, Web Push, Mobile Push, WhatsApp, Add Tag, Remove Tag, Update Field, Condition, Split, HTTP Request, etc.

#### Task 6: Update editor — Enable drag-drop, free connections, persist layout

**File:** `apps/frontend-react/src/features/automations/editor/automation-editor.tsx`

Major changes:
1. **Remove `AddStepEdge`** — switch all edges to `type: 'smoothstep'`
2. **Enable `nodesDraggable={true}`** — nodes can be moved freely
3. **Enable `nodesConnectable={true}`** — users can drag between handles to create edges
4. **Add `onDrop` / `onDragOver` handlers** — create nodes from sidebar drag
5. **Remove `layoutLinearFlow`** — positions come from user dragging or persisted layout
6. **Expose state via ref** — `useImperativeHandle` to let parent read live nodes/edges/stepIdCounter
7. **Save viewport** — capture `useReactFlow().getViewport()` on save

```typescript
// onDrop handler
const onDrop = useCallback((event: React.DragEvent) => {
  event.preventDefault()
  const type = event.dataTransfer.getData('application/reactflow')
  if (!type) return

  const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
  const newId = stepIdCounter + 1

  const newNode: AutomationNode = {
    id: String(newId),
    type,
    position,
    data: { stepId: newId, settings: DEFAULT_SETTINGS[type] ?? {} } as AnyNodeData,
  }

  setNodes((nds) => [...nds, newNode])
  setStepIdCounter(newId)
  markDirty()
}, [stepIdCounter, screenToFlowPosition, setNodes, markDirty])

const onDragOver = useCallback((event: React.DragEvent) => {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
}, [])
```

```typescript
// Expose editor state to parent via ref
useImperativeHandle(ref, () => ({
  getState: () => ({
    nodes,
    edges,
    stepIdCounter,
    viewport: reactFlowInstance?.getViewport(),
  }),
}), [nodes, edges, stepIdCounter, reactFlowInstance])
```

#### Task 7: Update save flow — Use ref, send flowLayout

**File:** `apps/frontend-react/src/features/automations/automation-form-page.tsx`

```typescript
const editorRef = useRef<AutomationEditorHandle>(null)

const handleSave = () => {
  const state = editorRef.current?.getState()
  if (!state) return

  const result = serializeFlowToSteps(state.nodes, state.edges)
  if (!result.success) { toast.error(result.error); return }

  const flowLayout: FlowLayout = {
    nodes: state.nodes.map(n => ({ id: n.id, position: n.position })),
    edges: state.edges.map(e => ({ id: e.id, source: e.source, target: e.target })),
    viewport: state.viewport,
  }

  const payload: AutomationPayload = {
    ...metadata,
    stepId: state.stepIdCounter,
    steps: result.root,
    flowLayout,
  }

  // create or update...
}
```

#### Task 8: Update deserializer — Restore from flowLayout

**File:** `apps/frontend-react/src/features/automations/editor/editor-serializer.ts`

Add a new function:

```typescript
export function deserializeWithLayout(
  rootStep: ApiStep,
  flowLayout: FlowLayout | null,
): DeserializeResult {
  const { nodes, edges, maxStepId } = deserializeStepsToFlow(rootStep)

  if (!flowLayout) return { nodes, edges, maxStepId }

  // Merge persisted positions into deserialized nodes
  const positionMap = new Map(flowLayout.nodes.map(n => [n.id, n.position]))
  const restoredNodes = nodes.map(node => {
    const pos = positionMap.get(node.id)
    return pos ? { ...node, position: pos } : node
  })

  // Use persisted edges if available (they may include user-created connections)
  // Fall back to tree-derived edges if not
  const restoredEdges = flowLayout.edges.length > 0
    ? flowLayout.edges.map(e => ({ ...e, type: 'smoothstep' as const }))
    : edges

  return { nodes: restoredNodes, edges: restoredEdges, maxStepId }
}
```

#### Task 9: Update i18n

Add keys for the new UI elements in both `pt-BR.json` and `en-US.json`:
- `automations.editor.editDetails` — "Edit details" / "Editar detalhes"
- `automations.editor.lastSaved` — "Last saved {{time}}" / "Salvo {{time}}"
- `automations.editor.draft` — "Draft" / "Rascunho"
- `automations.editor.buildingBlocks` — "Building blocks" / "Blocos"
- `automations.editor.actions` — "Actions" / "Ações"
- `automations.editor.timing` — "Timing" / "Tempo"
- `automations.editor.logic` — "Logic" / "Lógica"
- `automations.editor.contacts` — "Contacts" / "Contatos"
- `automations.editor.product` — "Product" / "Produto"
- `automations.editor.target` — "Target" / "Meta"
- `automations.editor.rateLimit` — "Rate limit" / "Controle de envio"
- Category/block names for the sidebar

## File Structure (Changes)

```
apps/frontend-react/src/features/automations/
├── automation-form-page.tsx           # REWRITE: Compact top bar + ref-based save
├── types.ts                           # UPDATE: Add flowLayout field
├── editor/
│   ├── types.ts                       # UPDATE: Add FlowLayout, AutomationEditorHandle
│   ├── editor-serializer.ts           # UPDATE: Add deserializeWithLayout
│   ├── automation-editor.tsx          # REWRITE: Drag-drop, free connect, ref handle
│   ├── edges/
│   │   ├── add-step-edge.tsx          # DELETE (replaced by smoothstep)
│   │   └── index.ts                   # DELETE or simplify
│   └── panels/
│       ├── automation-details-modal.tsx # NEW: Metadata edit modal
│       ├── blocks-sidebar.tsx          # NEW: Draggable step blocks
│       └── step-config-panel.tsx       # KEEP: Node config sheet

msgops-api/src/
├── entities/automation.entity.ts      # UPDATE: Add flow_layout column
├── modules/automations/
│   └── automation.dto.ts              # UPDATE: Add flowLayout to Joi schema
```

## Acceptance Criteria

### Functional Requirements

- [ ] **Fullscreen editor**: No page chrome except the compact top bar
- [ ] **Top bar**: Shows close button, status badge (Draft/Active toggle), automation name, last saved time, Save button
- [ ] **Edit details modal**: Opens from pencil icon; contains name, description, product, target, labels, rate limit
- [ ] **Labels multi-select**: Fetches from API, max 10, searchable
- [ ] **Internal-only fields**: Product, target, rate limit hidden for non-internal accounts
- [ ] **Drag-and-drop sidebar**: Right sidebar with categorized draggable blocks
- [ ] **Drop to create**: Dragging a block from the sidebar onto the canvas creates a node at the drop position
- [ ] **Free connections**: Users can drag from a source handle to a target handle to create edges
- [ ] **Node dragging**: Nodes can be repositioned freely on the canvas
- [ ] **Layout persistence**: Node positions and edges saved in `flow_layout` column, restored on load
- [ ] **Backward compatibility**: Automations without `flow_layout` fall back to auto-layout from tree
- [ ] **Save uses live state**: Save button serializes the editor's current state, not stale initial data
- [ ] **Vue 2 unaffected**: Vue 2 frontend continues working (doesn't send or read `flowLayout`)

### Non-Functional Requirements

- [ ] Top bar height ≤ 48px
- [ ] Sidebar width ~280px, collapsible
- [ ] Drag-and-drop works on touch devices (stretch goal)
- [ ] i18n: All new strings in pt-BR and en-US

### Quality Gates

- [ ] TypeScript type-check passes
- [ ] Existing serializer tests still pass
- [ ] New tests for `deserializeWithLayout`
- [ ] Manual test: create automation via drag-drop, save, reload, verify positions restored

## Dependencies & Prerequisites

- **Backend migration**: `flow_layout` column must be added before frontend can persist layout
- **Labels hook**: Need `useLabels` or similar for the multi-select in the modal (check if already exists in labels feature)

## Risk Analysis

| Risk | Impact | Mitigation |
|------|--------|------------|
| `flow_layout` and `steps` tree drift apart | High | Serialize tree from nodes/edges every time (flowLayout is visual-only supplement) |
| Drag-drop browser compat | Low | HTML5 Drag and Drop is widely supported; React Flow's examples use this pattern |
| Breaking existing automations | High | `flow_layout` is nullable; null = fallback to auto-layout; Vue 2 is unaffected |
| Save flow bug masks data loss | High | Fix via imperative ref before any other changes |

## Sources & References

### Internal References

- Current editor: `apps/frontend-react/src/features/automations/editor/automation-editor.tsx`
- Current form page: `apps/frontend-react/src/features/automations/automation-form-page.tsx`
- API entity: `msgops-api/src/entities/automation.entity.ts`
- API DTO: `msgops-api/src/modules/automations/automation.dto.ts`
- Vue 2 editor: `msgops-frontend/src/modules/automations/views/Automation.vue`

### External References

- React Flow drag-and-drop example: https://reactflow.dev/examples/interaction/drag-and-drop
- React Flow `screenToFlowPosition`: https://reactflow.dev/api-reference/hooks/use-react-flow
- Bird journey builder (design reference): app.bird.com
