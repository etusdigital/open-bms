---
title: 'feat: Add Condition Steps — Split, Conditional, Conditional Time'
type: feat
status: active
date: 2026-04-01
---

# Add Condition Steps — Split, Conditional, Conditional Time

## Overview

Add 3 condition step types plus their sub-node types: **split** (traffic split 2-5 paths), **conditional** (yes/no branch based on rules), and **conditionalTime** (time window gate). Split and conditional introduce **branching** into the flow — the first time a single node connects to multiple downstream paths in React Flow.

## Step Types Summary

| Step               |    Branching    | Sub-nodes                             | Settings                                |
| ------------------ | :-------------: | ------------------------------------- | --------------------------------------- |
| `split`            | Yes (2-5 paths) | `splitPath` per path                  | `{ "1": 50, "2": 50 }` (percentage map) |
| `conditional`      |  Yes (2 paths)  | `conditionalTrue`, `conditionalFalse` | `ConditionalRule[]` (1-10 rules)        |
| `conditionalTime`  |   No (linear)   | None                                  | `{ initialTime: 0-23, endTime: 0-23 }`  |
| `splitPath`        | No (container)  | —                                     | `{ path: "1", value: 50 }`              |
| `conditionalTrue`  | No (container)  | —                                     | `ConditionalRule[]` (same as parent)    |
| `conditionalFalse` | No (container)  | —                                     | `{}` (empty)                            |

## React Flow Architecture for Branching

### The Problem

Currently all nodes have a single source handle (bottom) → single target handle (top). For branching, a split/conditional node needs **multiple labeled source handles**, each connecting to a different downstream sub-node.

### The Solution: Multiple Named Handles

**Split node** — N source handles at the bottom, labeled "A", "B", "C", etc.:

```tsx
<Handle type="source" position={Position.Bottom} id="path-1" />
<Handle type="source" position={Position.Bottom} id="path-2" />
<Handle type="source" position={Position.Bottom} id="path-3" />
```

Each handle connects to the corresponding `splitPath` node. The edge carries `sourceHandle: "path-1"`.

**Conditional node** — 2 source handles, "Yes" (left) and "No" (right):

```tsx
<Handle type="source" position={Position.Bottom} id="yes" style={{ left: '33%' }} />
<Handle type="source" position={Position.Bottom} id="no" style={{ left: '66%' }} />
```

**splitPath / conditionalTrue / conditionalFalse** — These are "container" nodes that act as branch entry points. They have:

- A target handle (top) — connected from the parent split/conditional
- A source handle (bottom) — connecting to the first step in that branch
- A label showing the path name ("A: 50%") or "Yes"/"No"

### Serializer Updates

The existing serializer already handles multiple children per node — `step.child[]` can have multiple entries, each becoming a separate edge. The key changes:

1. **Deserialize**: When creating edges from split/conditional nodes, set `sourceHandle` to the path ID
2. **Serialize**: When building the tree, map edges back to child[] entries using the sourceHandle to determine ordering
3. **ID handling**: Support string IDs (`"path_42_0"`, `"conditional_55_1"`) alongside numeric IDs

### Single-Output Constraint Update

Currently `onConnect` enforces single-output (removes existing edge from source). For split/conditional nodes this must be **per-handle**, not per-node — each handle can have one outgoing edge, but the node can have multiple.

## Implementation Tasks

### Task 1: Update types

**File:** `editor/types.ts`

Add step types:

```typescript
| 'split' | 'splitPath' | 'conditional' | 'conditionalTrue' | 'conditionalFalse' | 'conditionalTime'
```

Add settings interfaces:

```typescript
export interface SplitSettings {
  [key: string]: number; // "1": 50, "2": 50, etc.
}

export interface SplitPathSettings {
  path: string; // "1" through "5"
  value: number; // percentage
}

export interface ConditionalTimeSettings {
  initialTime: number | string; // 0-23
  endTime: number | string; // 0-23
}
```

`ConditionalRule` already exists. `conditionalTrue` uses `ConditionalRule[]`, `conditionalFalse` uses `EmptySettings`.

### Task 2: Create node components

**Split node** (`split-node.tsx`):

- Yellow/amber themed
- Shows percentage distribution: "A: 50%, B: 50%"
- Multiple source handles at bottom (one per path)
- Handle positions spread evenly across the bottom

**SplitPath node** (`split-path-node.tsx`):

- Small label node: "Path A: 50%"
- Target handle (top), source handle (bottom)
- Not deletable (delete the parent split instead)
- No delete button

**Conditional node** (`conditional-node.tsx`):

- Orange/red themed
- Shows summary of first rule
- 2 source handles: "Yes" (left-ish) and "No" (right-ish)

**ConditionalTrue/False nodes**:

- Small label nodes: "Yes" (green) / "No" (gray)
- Target + source handles
- Not deletable

**ConditionalTime node** (`conditional-time-node.tsx`):

- Amber themed
- Shows time range: "09:00 - 18:00"
- Single source handle (linear, not branching)

### Task 3: Create config panels

**SplitConfig** — Sliders or number inputs for 2-5 paths, percentages must sum to 100. Add/remove path buttons (min 2, max 5).

**ConditionalConfig** — The rule builder. This is the most complex panel. For Phase 1, support a simplified version:

- A dropdown to select rule type
- Per-type form fields
- AND/OR connectors between rules
- Max 10 rules

> **Note**: The full conditional rule builder with all 7 types is very complex. Consider implementing a **simplified version** for Phase 1 with just 2-3 rule types (interation, tag, custom_field), and adding the rest in a follow-up.

**ConditionalTimeConfig** — Two selects for start hour (0-23) and end hour (0-23), with validation that start ≤ end.

### Task 4: Update serializer for branching

**File:** `editor/editor-serializer.ts`

Key changes to `deserializeStepsToFlow`:

- When a step has multiple children, create edges with `sourceHandle` IDs
- For split: `sourceHandle: "path-{index}"`
- For conditional: `sourceHandle: "yes"` / `sourceHandle: "no"`
- splitPath/conditionalTrue/conditionalFalse become actual nodes

Key changes to `serializeFlowToSteps`:

- When building the tree, sort children by sourceHandle to maintain path ordering
- Handle string IDs in the node-to-step mapping

### Task 5: Update single-output constraint

**File:** `editor/automation-editor.tsx`

Change `onConnect` to be per-handle for branching nodes:

```typescript
// Instead of removing ALL edges from source:
const filtered = eds.filter((e) => e.source !== connection.source);

// Remove only the edge from the SAME source handle:
const filtered = eds.filter((e) => !(e.source === connection.source && e.sourceHandle === connection.sourceHandle));
```

### Task 6: Update sidebar + defaults

Add to sidebar under "Conditions" (wait already there):

- Split
- Conditional
- Conditional Time

Add default settings for all new types.

### Task 7: Auto-create sub-nodes on drop

When a user drops a `split` from the sidebar, automatically create:

- The split node
- 2 splitPath child nodes (positioned below, side by side)
- 2 end nodes (one per path)
- Edges connecting them

Same for `conditional` → auto-create conditionalTrue, conditionalFalse, and end nodes.

### Task 8: i18n + type-check + test

Add all translation keys. Update serializer tests to cover branching cases.

## Tree Structure Examples

### Split with 3 paths (API format):

```json
{
  "id": 42, "type": "split",
  "settings": { "1": 34, "2": 33, "3": 33 },
  "child": [
    { "id": "path_42_0", "type": "splitPath", "settings": { "path": "1", "value": 34 },
      "child": [{ "id": 43, "type": "email", "settings": {...}, "child": [{ "id": 44, "type": "end", ... }] }]
    },
    { "id": "path_42_1", "type": "splitPath", "settings": { "path": "2", "value": 33 },
      "child": [{ "id": 45, "type": "end", ... }]
    },
    { "id": "path_42_2", "type": "splitPath", "settings": { "path": "3", "value": 33 },
      "child": [{ "id": 46, "type": "end", ... }]
    }
  ]
}
```

### Conditional (API format):

```json
{
  "id": 55, "type": "conditional",
  "settings": [{ "type": "tag", "conditional_tag": "in", "tag_id": [1], "tag_info": [{"id": 1, "name": "VIP"}] }],
  "child": [
    { "id": "conditional_55_1", "type": "conditionalTrue",
      "settings": [/* same rules */],
      "child": [{ "id": 56, "type": "email", ... }]
    },
    { "id": "conditional_55_2", "type": "conditionalFalse",
      "settings": {},
      "child": [{ "id": 57, "type": "end", ... }]
    }
  ]
}
```

## Acceptance Criteria

- [ ] Split: drop from sidebar auto-creates split + 2 paths + 2 end nodes
- [ ] Split: config panel with percentage sliders/inputs, sum to 100
- [ ] Split: can add/remove paths (2-5 range)
- [ ] Split: each path has labeled source handle, connects to splitPath node
- [ ] Conditional: drop auto-creates conditional + yes/no + 2 end nodes
- [ ] Conditional: config panel with rule builder (at least tag + interation types for Phase 1)
- [ ] Conditional: "Yes" and "No" labeled handles connect to branches
- [ ] ConditionalTime: linear node with hour range config
- [ ] Branching serializes correctly to API tree format
- [ ] Branching deserializes correctly from API tree
- [ ] Single-output constraint works per-handle for branching nodes
- [ ] Sub-nodes (splitPath, conditionalTrue, conditionalFalse) are not deletable
- [ ] Deleting a split/conditional deletes all its sub-nodes and branches
- [ ] TypeScript type-check passes
- [ ] Serializer roundtrip tests for branching
- [ ] i18n in pt-BR and en-US

## Complexity Note

This is the most architecturally significant change since the initial editor implementation. The conditional rule builder alone (7 rule types × multiple operators each) is a substantial UI. Consider splitting into:

- **Phase A**: Split + ConditionalTime + basic Conditional (tag rules only)
- **Phase B**: Full conditional rule builder (all 7 rule types)

## Sources

- Vue2 SplitComponent: `apps/frontend-vue2/src/modules/automations/components/UpdateModal/SplitComponent.vue`
- Vue2 ConditionalComponent: `apps/frontend-vue2/src/modules/automations/components/UpdateModal/ConditionalComponent.vue`
- Vue2 ConditionalTimeComponent: `apps/frontend-vue2/src/modules/automations/components/UpdateModal/ConditionalTimeComponent.vue`
- Vue2 RenderChild branching: `apps/frontend-vue2/src/modules/automations/components/RenderChild.vue:62-106`
- Vue2 Automation.vue definedSplit/definedConditional: `apps/frontend-vue2/src/modules/automations/views/Automation.vue:868-911`
- API schema: `apps/msgops-api/src/modules/automations/schema/automation-schema.json`
- React Flow multiple handles: https://reactflow.dev/learn/customization/custom-nodes#multiple-handles
