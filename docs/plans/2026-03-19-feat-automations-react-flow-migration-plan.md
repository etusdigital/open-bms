---
title: "feat: Migrate Automations Editor to React Flow"
type: feat
status: active
date: 2026-03-19
---

# Migrate Automations Visual Editor from Vue 2 to React + React Flow

## Enhancement Summary

**Deepened on:** 2026-03-19
**Research agents used:** TypeScript Reviewer, Architecture Strategist, Simplicity Reviewer, Frontend Races Reviewer, Pattern Recognition Specialist, Best Practices Researcher, Framework Docs Researcher, Context7 (React Flow v12 docs)

### Key Improvements from Research
1. **Discriminated union types** instead of `Record<string, unknown>` — eliminates unsafe casts in every node component
2. **Simplified Phase 1 state** — use React Flow's built-in `useNodesState`/`useEdgesState` instead of premature useReducer + Immer
3. **No dagre for Phase 1** — linear flows need only fixed Y offsets (one-liner), defer dagre to Phase 2 branching
4. **Save race protection** — state machine (`idle`/`saving`/`dirty-while-saving`) prevents silent data loss
5. **Corrected route conventions** — directory-based routing with `create.tsx` and `$automationId.tsx` matching codebase patterns
6. **Serializer error handling** — return result type with failure path, not just `AutomationStep`
7. **Query key factory registration** — fix existing inline keys by adding automations to `query-keys.ts`

### New Risks Discovered
- **Save race condition**: User edits while save is in-flight → server overwrites local changes (mitigated with save guard)
- **Load timing**: Deserializing in `useEffect` causes one-frame empty canvas flash (mitigated with synchronous `useMemo`)
- **nodeTypes re-registration**: Defining `nodeTypes` inside component causes React Flow to unmount/remount all nodes on every render

---

## Overview

Migrate the full automation system (list, create, edit) from the Vue 2 `msgops-frontend` to the React `frontend-react` app using **@xyflow/react** (React Flow v12) as the visual editor. The critical constraint: the API payload format must remain identical — we serialize React Flow's flat `nodes[]` + `edges[]` model into the recursive `steps` tree the NestJS backend expects, and deserialize the tree back into React Flow on load.

**Phase 1 (this plan):** Support the 3 foundational step types — **trigger**, **wait**, and **email** — plus the always-present **end** node. This is enough to build and save a basic automation. Future phases add all remaining step types incrementally.

## Problem Statement

The Vue 2 automation editor is a custom recursive renderer (`RenderChild.vue`) with manual SVG connector lines, mouse-drag panning, and Ctrl+wheel zoom. It works but:

- Is tightly coupled to Vue 2 class components and Vuex
- Has no concept of a node/edge graph — it re-renders the entire tree on every change
- The frontend-react app already has an automations **list page** but no create/edit flow editor

React Flow gives us a proper graph library with built-in pan/zoom, drag-to-connect, custom nodes, layout algorithms, and a large ecosystem — while being the industry standard for flow editors in React.

## Proposed Solution

### Architecture

```
React Flow (visual)               API (backend)
┌─────────────────┐              ┌──────────────────┐
│  nodes: Node[]  │  serialize   │  steps: {        │
│  edges: Edge[]  │ ──────────→  │    id, type,     │
│                 │              │    settings,     │
│                 │  deserialize │    child: [...]  │
│                 │ ←──────────  │  }               │
└─────────────────┘              └──────────────────┘
```

**Key design decisions:**

1. **Bidirectional converter** (`editor-serializer.ts`): Converts between React Flow's flat `Node[] + Edge[]` and the API's recursive tree. Follows the same proven pattern as `builder-serializer.ts` in the segments feature.

2. **Custom nodes per step type**: Each step type gets its own React component rendered inside React Flow. The node's `data` property holds **typed** step settings via a discriminated union.

3. **Vertical (top-to-bottom) layout**: Matches the existing Vue 2 visual style. Phase 1 uses simple fixed Y-offset stacking (linear chains only). Phase 2 introduces `dagre` for branching layout.

4. **Step ID counter preservation**: The API uses `stepId` as an incrementing counter. Initialized to `Math.max(...existingIds) + 1` on load, incremented in state on every node add.

5. **Same API endpoints**: `POST /automations/complete` (create), `PUT /automations/complete` (update), `GET /automations/:id` (load). No backend changes needed.

### Research Insights — Architecture

**State management boundary** (Architecture Strategist): React Flow manages the graph presentation (positions, selection, viewport). Our state manages the domain model (step configurations, dirty tracking, save state). For Phase 1's linear flows, React Flow's built-in `useNodesState`/`useEdgesState` hooks are sufficient. Phase 2 branching will need a useReducer migration if the complexity warrants it.

**Serializer is highest-risk module** (Architecture Strategist): The segment builder's serializer translates between two flat-ish representations. The automation serializer must translate between a recursive tree and a flat graph — fundamentally harder with more failure modes. Edge ordering must encode sibling order (React Flow edges are unordered by default). Node IDs must be stable across serialize/deserialize cycles.

## Technical Approach

### Step Tree ↔ React Flow Data Model

The API stores steps as a recursive tree:

```json
{
  "id": 1, "type": "trigger", "settings": { ... },
  "child": [
    {
      "id": 2, "type": "wait", "settings": { "timer": 24, "timerType": "hours" },
      "child": [
        {
          "id": 3, "type": "email", "settings": { "id": 10, "name": "slug", "title": "Welcome" },
          "child": [
            { "id": 4, "type": "end", "settings": {}, "child": [] }
          ]
        }
      ]
    }
  ]
}
```

React Flow needs flat arrays:

```typescript
// Nodes — typed with Node<AutomationNodeData>
[
  { id: "1", type: "trigger", position: { x: 0, y: 0 }, data: { stepId: 1, settings: { type: "tag", name: "welcome" } } },
  { id: "2", type: "wait", position: { x: 0, y: 150 }, data: { stepId: 2, settings: { timer: 24, timerType: "hours" } } },
  { id: "3", type: "email", position: { x: 0, y: 300 }, data: { stepId: 3, settings: { id: 10, name: "slug", title: "Welcome" } } },
  { id: "4", type: "end", position: { x: 0, y: 450 }, data: { stepId: 4, settings: {} } },
]

// Edges
[
  { id: "e1-2", source: "1", target: "2", type: "addStepEdge" },
  { id: "e2-3", source: "2", target: "3", type: "addStepEdge" },
  { id: "e3-4", source: "3", target: "4", type: "addStepEdge" },
]
```

### Branching (future — conditional/split)

For branching nodes (Phase 2+), each `child[]` entry maps to a separate edge from the parent. The node IDs for split paths use the existing string format (`"path_3_0"`, `"conditional_5_1"`) to maintain API compatibility. Phase 2 will introduce `dagre` (or `@dagrejs/dagre`) for automatic multi-column layout.

### Implementation Phases

---

#### Phase 1: Foundation + Basic Steps (trigger, wait, email, end)

##### Task 1.1: Install dependencies

**File:** `apps/frontend-react/package.json`

```bash
pnpm --filter @retention/frontend add @xyflow/react
```

- `@xyflow/react` — React Flow v12 (the graph library)

> **Research Insight (Simplicity Reviewer):** dagre is unnecessary for Phase 1. Linear flows are vertical stacking — `position: { x: 0, y: index * NODE_SPACING }`. Install dagre in Phase 2 when branching layout is needed.

##### Task 1.2: Define TypeScript types for the automation flow

**File:** `apps/frontend-react/src/features/automations/editor/types.ts`

> **Research Insight (TypeScript Reviewer):** Use a **discriminated union** on the step type to correlate `type` with `settings`. The original plan used `Record<string, unknown>` which swallows the entire union — TypeScript will never narrow the type for you, and every node component will need unsafe casts.

```typescript
import type { Node, Edge } from '@xyflow/react'

// --- Phase 1 step types ---
export type AutomationStepType = 'trigger' | 'wait' | 'email' | 'end'

// --- Settings interfaces (match API exactly) ---
export interface TriggerSettings {
  id?: number
  type?: 'tag' | 'events' | 'custom_events' | 'web-push' | 'mobile-push'
  name?: string
  applyFrequency?: 'unique' | 'multiply' | 'multiply-period'
  timePeriod?: number
  typeMultiply?: 'days' | 'hours' | 'minutes' | ''
  eventType?: 'open' | 'click' | 'first_open_30_days'
  title?: string
  conditional?: ConditionalRule[]
}

export interface WaitSettings {
  timer: number
  timerType: 'hours' | 'minutes'
}

export interface EmailSettings {
  id?: number
  name?: string
  title?: string
  subject?: string
  links?: Array<{ url: string; id: string }>
}

export type EmptySettings = Record<string, never>

export interface ConditionalRule {
  type: string
  conditional?: 'and' | 'or'
  [key: string]: unknown
}

// --- Discriminated union: step type correlates with settings ---
interface StepBase<T extends AutomationStepType, S> {
  id: number
  type: T
  settings: S
  child: AutomationStep[]
}

export type AutomationStep =
  | StepBase<'trigger', TriggerSettings>
  | StepBase<'wait', WaitSettings>
  | StepBase<'email', EmailSettings>
  | StepBase<'end', EmptySettings>

// For the serializer to handle unsupported step types from future phases:
export interface UnsupportedStep {
  id: number
  type: string
  settings: Record<string, unknown>
  child: UnsupportedStep[]
}

// Union that handles both known and unknown steps on API responses
export type ApiStep = AutomationStep | UnsupportedStep

// --- Full automation DTO (matches API POST/PUT /automations/complete) ---
export interface AutomationPayload {
  id?: number
  title: string
  description?: string
  type?: string                    // 'email'
  isActive: boolean
  isRateLimit: boolean
  stepId: number                   // auto-incrementing counter for step IDs
  steps: ApiStep                   // the root trigger node (single step, not array)
  verticalType?: string
  target?: string
  labels?: Array<{ id: number; name: string }>
}

// --- React Flow node data (discriminated by step type) ---
export type TriggerNodeData = { stepId: number; settings: TriggerSettings }
export type WaitNodeData = { stepId: number; settings: WaitSettings }
export type EmailNodeData = { stepId: number; settings: EmailSettings }
export type EndNodeData = { stepId: number; settings: EmptySettings }

export type AutomationNodeData =
  | TriggerNodeData
  | WaitNodeData
  | EmailNodeData
  | EndNodeData

// --- Typed React Flow node ---
export type AutomationNode = Node<AutomationNodeData>
export type AutomationEdge = Edge
```

> **Research Insight (TypeScript Reviewer):** Parameterize React Flow generics (`Node<AutomationNodeData>`) throughout. Otherwise the consumer gets `unknown` for `node.data` and you are back to casting everywhere. Use `satisfies NodeTypes` for the registry to ensure type safety.

##### Task 1.3: Build the flow serializer (bidirectional converter)

**File:** `apps/frontend-react/src/features/automations/editor/editor-serializer.ts`

> **Research Insight (Pattern Recognition):** Rename from `flow-serializer.ts` to `editor-serializer.ts` to match the segment builder's naming convention (`builder-serializer.ts`). All files in the editor/ subdirectory should be prefixed with `editor-`.

Three main functions:

1. **`deserializeStepsToFlow(rootStep: ApiStep): { nodes: AutomationNode[], edges: AutomationEdge[], maxStepId: number }`**
   - Walk the recursive tree depth-first
   - Create a `Node<AutomationNodeData>` for each step (id = step.id.toString(), type = step.type, data = { stepId, settings })
   - Create an `Edge` from parent to each child
   - Apply simple linear layout: `position: { x: 0, y: index * NODE_SPACING }`
   - Track and return the max step ID encountered (for counter initialization)
   - For unknown step types: wrap as an "unsupported" node with raw JSON display

2. **`serializeFlowToSteps(nodes: AutomationNode[], edges: AutomationEdge[]): SerializeResult`**
   - Find the root node (type = 'trigger', or the node with no incoming edges)
   - Walk the graph using edges to rebuild the recursive tree
   - For each node, find outgoing edges → sort by target position → recurse into children
   - **Return a result type, not just AutomationStep** (can fail if graph is disconnected/cyclic)

   ```typescript
   export type SerializeResult =
     | { success: true; root: AutomationStep }
     | { success: false; error: string }
   ```

3. **`layoutLinearFlow(nodes: AutomationNode[]): AutomationNode[]`**
   - Phase 1 only: assign `position: { x: 0, y: index * NODE_SPACING }` based on graph traversal order
   - No dagre dependency needed

> **Research Insight (Architecture Strategist):** Ensure tests cover: empty automation, single-node automation, deep nesting, and unknown/unsupported step types for forward-compatibility. Add a `roundTrip` assertion: `serialize(deserialize(apiPayload))` must equal the original payload.

Write unit tests in `__tests__/editor-serializer.test.ts` that roundtrip from tree → flow → tree and verify equality.

##### Task 1.4: Create custom node components

**Directory:** `apps/frontend-react/src/features/automations/editor/nodes/`

> **Research Insight (React Flow v12 Docs):** The `nodeTypes` object MUST be defined outside the component or memoized with `useMemo`. If defined inside the component body, React Flow will unmount and remount all nodes on every render. Use `satisfies NodeTypes` for type checking.

```typescript
// nodes/index.ts — DEFINE OUTSIDE ANY COMPONENT
import type { NodeTypes } from '@xyflow/react'
import { TriggerNode } from './trigger-node'
import { WaitNode } from './wait-node'
import { EmailNode } from './email-node'
import { EndNode } from './end-node'

export const automationNodeTypes = {
  trigger: TriggerNode,
  wait: WaitNode,
  email: EmailNode,
  end: EndNode,
} as const satisfies NodeTypes
```

Each custom node is a React component with proper typing:

- **`trigger-node.tsx`** — Displays trigger type icon + label. Single output handle (bottom). Click opens config panel.
- **`wait-node.tsx`** — Shows timer value + unit. Input handle (top), output handle (bottom).
- **`email-node.tsx`** — Shows email title/subject. Input handle (top), output handle (bottom).
- **`end-node.tsx`** — Simple "End" label. Input handle (top) only.

```typescript
// Example: wait-node.tsx — properly typed, no casting needed
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { WaitNodeData } from '../types'
import { useTranslation } from 'react-i18next'

export const WaitNode = memo(function WaitNode({ data }: NodeProps) {
  const { t } = useTranslation()
  const { settings } = data as WaitNodeData

  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm min-w-[200px]">
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          {t('automations.editor.wait', { timer: settings.timer, unit: t(`automations.editor.${settings.timerType}`) })}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
})
```

> **Research Insight (Performance):** Wrap all custom nodes in `React.memo` to prevent re-renders when unrelated nodes change. React Flow passes stable props when a node hasn't changed.

##### Task 1.4b: Create custom edge with "add step" button

**File:** `apps/frontend-react/src/features/automations/editor/edges/add-step-edge.tsx`

> **Research Insight (React Flow v12 Docs):** Use `EdgeLabelRenderer` with `getBezierPath` or `getSmoothStepPath` to render interactive buttons on edges. Add `className="nodrag nopan"` and `pointerEvents: 'all'` for the button to be clickable.

```typescript
// edges/add-step-edge.tsx
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react'

export function AddStepEdge(props: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath(props)

  return (
    <>
      <BaseEdge path={edgePath} {...props} />
      <EdgeLabelRenderer>
        <button
          className="nodrag nopan absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary text-primary-foreground h-6 w-6 flex items-center justify-center text-xs hover:scale-110 transition-transform"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: 'all' }}
          onClick={() => props.data?.onAddStep?.(props.source, props.target)}
        >
          +
        </button>
      </EdgeLabelRenderer>
    </>
  )
}

// edges/index.ts
export const automationEdgeTypes = {
  addStepEdge: AddStepEdge,
} as const
```

##### Task 1.5: Build the step configuration panel

**File:** `apps/frontend-react/src/features/automations/editor/panels/step-config-panel.tsx`

> **Research Insight (Simplicity Reviewer):** In Phase 1, each panel is tiny (15-20 lines of JSX). Use a single `step-config-panel.tsx` with a switch on step type instead of 3 separate files. Extract into separate files when they grow complex in later phases.

A Sheet (side panel) that opens when a node is clicked, displaying the config form for that step type:

- **Trigger config**: Select trigger type + conditional fields per type (tag selector, event selector, etc.)
- **Wait config**: Number input for timer + select for timerType (hours/minutes)
- **Email config**: SearchableSelect for existing messages from API

Use plain controlled components with `useState` for Phase 1 forms. Add react-hook-form + zod when forms get complex (Phase 2 conditional rule builder).

> **Research Insight (Frontend Races Reviewer):** When the user clicks a different node, the panel must update to the new node's settings. Key the panel by `selectedNodeId` to force a remount: `<StepConfigPanel key={selectedNodeId} ... />`. This prevents stale state from the previous node leaking into the new panel.

Also create:
- **`add-step-modal.tsx`** — Dialog listing available step types. Phase 1 shows: wait, email. Clicking one inserts the node between the source and target of the clicked edge.

##### Task 1.6: Build the main editor component

**File:** `apps/frontend-react/src/features/automations/editor/automation-editor.tsx`

> **Research Insight (Simplicity Reviewer):** Use React Flow's built-in `useNodesState`/`useEdgesState` hooks for Phase 1 instead of a custom useReducer + Immer. These hooks combine `useState` with change handlers. Add a few `useState` calls for `stepIdCounter`, `selectedNodeId`, and save state. Migrate to useReducer when Phase 2 complexity demands it.

```typescript
import { ReactFlow, useNodesState, useEdgesState, type OnNodeClick, ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { automationNodeTypes } from './nodes'
import { automationEdgeTypes } from './edges'

// CRITICAL: nodeTypes and edgeTypes defined OUTSIDE component
// If defined inside, React Flow unmounts/remounts all nodes on every render

interface AutomationEditorProps {
  initialNodes: AutomationNode[]
  initialEdges: AutomationEdge[]
  initialStepIdCounter: number
  onSave: (nodes: AutomationNode[], edges: AutomationEdge[]) => void
  isSaving: boolean
}

function AutomationEditorInner({ initialNodes, initialEdges, initialStepIdCounter, onSave, isSaving }: AutomationEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [stepIdCounter, setStepIdCounter] = useState(initialStepIdCounter)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  // Save guard state machine
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'dirty-while-saving'>('idle')
  const [isDirty, setIsDirty] = useState(false)

  // ... node add/remove/update handlers
  // ... save handler with race protection
}

// Wrap in ReactFlowProvider for useReactFlow() access in child components
export function AutomationEditor(props: AutomationEditorProps) {
  return (
    <ReactFlowProvider>
      <AutomationEditorInner {...props} />
    </ReactFlowProvider>
  )
}
```

> **Research Insight (Frontend Races Reviewer — CRITICAL):** Implement a save guard state machine to prevent the save race condition:
>
> ```
> idle → (user clicks save) → saving
> saving → (save succeeds, no edits during save) → idle (isDirty = false)
> saving → (user edits during save) → dirty-while-saving
> dirty-while-saving → (save succeeds) → idle (isDirty = true, prompt re-save)
> saving → (save fails) → idle (isDirty = true, show error)
> ```
>
> **Do NOT invalidate TanStack Query cache on save success if `saveState === 'dirty-while-saving'`**. The local state is the source of truth while the editor is open. Only invalidate on navigation away or on a clean save.

> **Research Insight (Frontend Races Reviewer):** Deserialize the API data synchronously in `useMemo`, NOT in `useEffect`. An effect runs after render, causing a one-frame empty canvas flash before the graph appears.
>
> ```typescript
> const { data: automation, isLoading } = useAutomationDetail(id)
> const editorState = useMemo(() => {
>   if (!automation?.steps) return null
>   return deserializeStepsToFlow(automation.steps)
> }, [automation])
> // Only render the editor when editorState is ready
> ```

Key behaviors:
- Click on a node → open its config panel (Sheet from right side)
- Click "+" button on an edge → open add-step modal → insert node between source and target
- Delete a node → reconnect parent to child
- Keyboard: Delete/Backspace to remove selected node
- Dirty state tracking: only set `isDirty` on data mutations (node add/remove/settings update), NOT on viewport/selection changes

##### Task 1.7: Build the automation form page (create/edit)

**File:** `apps/frontend-react/src/features/automations/automation-form-page.tsx`

Top-level page that wraps the editor with the automation metadata form:

- Title input (max 25 chars internal / 40 chars external)
- Description textarea (max 255 chars)
- Active/Inactive toggle
- Rate limit toggle
- Labels multi-select
- Save / Cancel buttons
- Unsaved changes dialog on navigation (use existing `UnsavedChangesDialog` component)

Uses `FormPage` compound component pattern from the codebase.

##### Task 1.8: Create routes

> **Research Insight (Pattern Recognition):** The codebase uses **directory-based routing** for create/edit sub-routes, NOT dot-notation. Every entity (campaigns, segments, labels, etc.) uses `create.tsx` and `$entityId.tsx` inside subdirectories. The param should be `$automationId`, not `$id`.

**Files:**
```
apps/frontend-react/src/routes/_authenticated/_layout/automations/
  emails/
    index.tsx           # List page (replaces automations.emails.tsx)
    create.tsx          # Create page → /automations/emails/create
    $automationId.tsx   # Edit page → /automations/emails/:automationId
```

This matches the existing conventions:
```
campaigns/create.tsx, campaigns/$campaignId.tsx
segments/create.tsx, segments/$segmentId.tsx
labels/create.tsx, labels/$labelId.tsx
```

##### Task 1.9: Register query keys and add TanStack Query hooks

> **Research Insight (Pattern Recognition):** The existing `use-automations.ts` uses inline query keys instead of the `createEntityQueryKeys` factory. Every other entity uses the factory. Fix this first.

**File:** `apps/frontend-react/src/lib/query-keys.ts` — register automations:

```typescript
export const queryKeys = {
  // ... existing entries
  automations: createEntityQueryKeys('automations'),
}
```

**File:** `apps/frontend-react/src/features/automations/use-automations.ts` — extend with:

```typescript
// Refactor existing hooks to use queryKeys.automations.list(...) instead of inline keys

// NEW: Fetch single automation with full step tree
export function useAutomationDetail(id: number) {
  return useQuery<Automation>({
    queryKey: queryKeys.automations.detail(id),
    queryFn: () => apiClient.get(`/automations/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

// NEW: Create automation (POST /automations/complete)
export function useCreateAutomation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: AutomationPayload) =>
      apiClient.post<Automation>('/automations/complete', payload).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all })
    },
  })
}

// NEW: Update automation (PUT /automations/complete)
export function useUpdateAutomation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: AutomationPayload) =>
      apiClient.put<Automation>('/automations/complete', payload).then(r => r.data),
    // Invalidation handled by editor save guard, not blindly here
  })
}

// NEW: Validate name uniqueness (debounced query, not mutation)
export function useValidateAutomationName(title: string, id?: number) {
  return useQuery<{ available: boolean }>({
    queryKey: ['automations', 'validate-name', title, id],
    queryFn: () => apiClient.get('/automations/validate-name', { params: { titleCreate: title, id } }).then(r => r.data),
    enabled: title.length >= 3,
  })
}
```

> **Research Insight (TypeScript Reviewer):** `useValidateAutomationName` should be a query with `enabled` gating + debounced input, not a mutation. It is a read operation. Use TanStack Query's `enabled` flag combined with a debounced state value.

##### Task 1.10: Enhance the list page

**File:** `apps/frontend-react/src/features/automations/automations-page.tsx`

- Add "Create" button (navigates to `/automations/emails/create`)
- Make title column clickable (navigates to `/automations/emails/:id`)
- Add active/inactive toggle switch in the table row

##### Task 1.11: Update types.ts with full Automation interface

**File:** `apps/frontend-react/src/features/automations/types.ts`

Extend the existing minimal `Automation` interface:

```typescript
import type { ApiStep } from './editor/types'

export interface Automation {
  id: number
  title: string
  description?: string
  type: string
  isActive: boolean
  isRateLimit: boolean
  stepId: number
  steps?: ApiStep                  // the full recursive tree (may contain unknown step types)
  stepsCount?: number
  verticalType?: string
  target?: string
  labels?: Array<{ id: number; name: string }>
  createdAt?: string
  updatedAt?: string
}
```

##### Task 1.12: Add i18n translations

**Files:**
- `apps/frontend-react/src/locales/pt-BR.json`
- `apps/frontend-react/src/locales/en-US.json`

Add translation keys under `automations.editor.*` matching the existing Vue 2 translations. Reference the existing Vue 2 i18n files for exact copy.

---

#### Phase 2: Branching Steps (conditional, split) — Future

- Install `@dagrejs/dagre` for automatic multi-column branching layout
- **conditional node**: Yes/No branches, conditional rule builder (reuse segment builder components)
- **split node**: Traffic split with 2-5 paths, percentage sliders summing to 100%
- **conditionalTime node**: Time window gate
- Serializer: handle `child[]` arrays with multiple entries, path IDs (`path_3_0`, `conditional_5_1`)
- Evaluate migration from `useNodesState`/`useEdgesState` to `useReducer` + Immer if state complexity warrants it (split contexts pattern like segment builder)

#### Phase 3: All Remaining Steps — Future

- Send: webPush, sms, mobilePush, whatsapp, testAB, randomMessage, randomWebPush, randomMobilePush
- Contacts: addTag, removeTag, updateCustomField, contactValidate, contactTransfer, removeAutomation
- Integrations: httpRequest, activeCampaign
- Each is a new custom node + config panel, minimal serializer changes
- Expand `AutomationStepType` union and `AutomationStep` discriminated union as needed

#### Phase 4: Enhanced React Flow Features — Future

- Drag-to-reorder nodes (reparent in tree)
- Copy/paste subtrees
- Undo/redo
- Mini-map
- Keyboard shortcuts
- Step statistics overlay (contacts in each step)
- Audit history viewer
- Work directly with React Flow node format in the API (new endpoints)

## File Structure (Phase 1)

```
apps/frontend-react/src/features/automations/
├── automations-page.tsx          # List page (existing, enhanced)
├── automations-columns.tsx       # Table columns (existing, enhanced)
├── automation-form-page.tsx      # NEW: Create/Edit page wrapper
├── types.ts                      # Enhanced with full Automation interface
├── use-automations.ts            # Enhanced with detail/create/update hooks + query key factory
├── __tests__/
│   └── editor-serializer.test.ts # NEW: Roundtrip serializer tests
└── editor/
    ├── types.ts                  # NEW: Discriminated union step types, node data, API payload
    ├── editor-serializer.ts      # NEW: tree ↔ React Flow converter (named per convention)
    ├── automation-editor.tsx     # NEW: Main React Flow editor
    ├── nodes/
    │   ├── index.ts              # NEW: nodeTypes registry (STATIC, outside components)
    │   ├── trigger-node.tsx      # NEW (memo wrapped)
    │   ├── wait-node.tsx         # NEW (memo wrapped)
    │   ├── email-node.tsx        # NEW (memo wrapped)
    │   └── end-node.tsx          # NEW (memo wrapped)
    ├── edges/
    │   ├── index.ts              # NEW: edgeTypes registry
    │   └── add-step-edge.tsx     # NEW: Edge with "+" button via EdgeLabelRenderer
    └── panels/
        ├── step-config-panel.tsx # NEW: Single panel with switch on step type
        └── add-step-modal.tsx    # NEW: Dialog for selecting step type to add

apps/frontend-react/src/routes/_authenticated/_layout/
├── automations/
│   └── emails/
│       ├── index.tsx             # List (replaces automations.emails.tsx)
│       ├── create.tsx            # NEW: create route
│       └── $automationId.tsx     # NEW: edit route
```

## Acceptance Criteria

### Functional Requirements

- [ ] **List page**: Shows all automations with search, sort, pagination, delete, duplicate, active toggle, and "Create" button
- [ ] **Create page**: Blank editor with trigger node + end node. User can add wait and email steps between them.
- [ ] **Edit page**: Loads existing automation from API, renders the step tree in React Flow, allows editing and saving
- [ ] **Save (create)**: Serializes React Flow to the exact recursive tree format and POSTs to `/automations/complete`
- [ ] **Save (update)**: Serializes and PUTs to `/automations/complete` with save race protection
- [ ] **Roundtrip fidelity**: Load an automation created in Vue 2 → edit in React → save → load again in Vue 2 → no data loss
- [ ] **Step configuration**: Click a node to open its config panel; changes update the node data
- [ ] **Add step**: Click "+" on an edge to insert a new step between two existing steps
- [ ] **Remove step**: Delete a step and reconnect its parent to its child
- [ ] **Validation**: Title required (max 25/40 chars), trigger must be configured before save
- [ ] **Unsaved changes**: Warn user before navigating away with unsaved changes
- [ ] **Unsupported steps**: Steps created by Vue 2 that React doesn't support yet render as generic cards with type label

### Non-Functional Requirements

- [ ] Responsive editor (works on 1280px+ screens)
- [ ] Accessible: keyboard navigation for node selection, ARIA labels on controls
- [ ] i18n: All strings in pt-BR and en-US
- [ ] Loading states: Skeleton for editor while fetching automation (no empty canvas flash)
- [ ] Error handling: Toast on API errors, validation errors highlighted on nodes
- [ ] Save button disabled during in-flight save (with visual indicator)

### Quality Gates

- [ ] Unit tests for `editor-serializer.ts` (parse, serialize, roundtrip, error cases, unsupported types)
- [ ] No TypeScript errors (`pnpm type-check` passes)
- [ ] ESLint passes (`pnpm lint`)
- [ ] Manual testing: create, edit, save, reload in both Vue 2 and React
- [ ] nodeTypes and edgeTypes defined as static constants (verified no re-registration warnings)

## Dependencies & Prerequisites

- **No backend changes needed** — reuses all existing API endpoints
- **@xyflow/react** v12+ — MIT licensed, actively maintained
- **No dagre for Phase 1** — simple linear layout only
- Existing shadcn/ui components: Dialog, Sheet, Button, Input, Select, Badge, Card, Tooltip, Command (for SearchableSelect)
- May need to add: `Slider` (for split percentages in Phase 2), `Tabs` (for panel sections)

## Risk Analysis & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Serializer bug causes data loss | **High** | Exhaustive roundtrip unit tests; `SerializeResult` error type; read-back verification after save |
| Save race condition (user edits during in-flight save) | **High** | Save guard state machine (`idle`/`saving`/`dirty-while-saving`); disable save button during save; don't invalidate cache while dirty |
| React Flow performance with large automations (100+ steps) | Medium | React.memo on all custom nodes; static nodeTypes/edgeTypes; React Flow virtualizes offscreen nodes |
| Step ID counter desync | Medium | Initialize to `Math.max(...existingIds) + 1` on load; increment only via state setter |
| Vue 2 creates steps that React doesn't support yet | Low | Render unsupported nodes as generic "unknown" cards with type label |
| nodeTypes defined inside component | Medium | Static module-level constant; build-time linting to verify |
| Load timing — empty canvas flash | Medium | Synchronous deserialization in `useMemo`, not `useEffect`; skeleton until ready |

## Sources & References

### Internal References

- Vue 2 automation editor: `msgops-frontend/src/modules/automations/views/Automation.vue`
- Vue 2 recursive renderer: `msgops-frontend/src/modules/automations/components/RenderChild.vue`
- Vue 2 step config modals: `msgops-frontend/src/modules/automations/components/UpdateModal/*.vue`
- Vue 2 service: `msgops-frontend/src/modules/automations/services/automations.service.ts`
- Vue 2 DTO: `msgops-frontend/src/modules/automations/dtos/automation.dto.ts`
- API controller: `msgops-api/src/modules/automations/automations.controller.ts`
- API validation schema: `msgops-api/src/modules/automations/schema/automation-schema.json`
- Segment builder serializer (pattern reference): `apps/frontend-react/src/features/segments/builder/builder-serializer.ts`
- Segment builder context (pattern reference): `apps/frontend-react/src/features/segments/builder/builder-context.tsx`
- Query key factory: `apps/frontend-react/src/lib/query-keys.ts`

### External References

- React Flow docs: https://reactflow.dev/
- React Flow custom nodes: https://reactflow.dev/learn/customization/custom-nodes
- React Flow dagre layout example: https://reactflow.dev/examples/layout/dagre
- React Flow EdgeLabelRenderer: https://reactflow.dev/api-reference/components/edge-label-renderer
- React Flow TypeScript guide: https://reactflow.dev/learn/advanced-use/typescript
- React Flow v12 migration: https://reactflow.dev/learn/troubleshooting/migrate-to-v12
