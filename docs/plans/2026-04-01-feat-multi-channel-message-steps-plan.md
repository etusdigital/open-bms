---
title: 'feat: Add Multi-Channel Message Steps (Web Push, Mobile Push, SMS, WhatsApp)'
type: feat
status: active
date: 2026-04-01
---

# Add Multi-Channel Message Steps

## Overview

Extend the automation editor to support all 5 message channels: email (already done), **web push**, **mobile push**, **SMS**, and **WhatsApp**. Each channel gets a single-message step and a random-message (multiple) step. A/B test remains email-only. Steps for channels the account doesn't have access to are shown as disabled in the sidebar.

## Current State

**Already implemented:**

- `email` — single message step with searchable select
- `testAB` — A/B test (email only, max 4 messages)
- `randomMessage` — random email (max 10 messages)

**Needs adding:**

- `webPush`, `mobilePush`, `sms`, `whatsapp` — single message steps
- `randomWebPush`, `randomMobilePush` — random message variants

**No random variant exists for SMS or WhatsApp** (not in Vue2 either).

## Key Design Decisions

### 1. All channels share the same settings shape

The API schema (`obj_message`) is identical for all 5 channels: `{ id, name, title, subject, links }`. The only difference is the `type` param when fetching messages from the API.

### 2. Channel-to-API type mapping

| Step type          | API `type` param |
| ------------------ | ---------------- |
| `email`            | `email`          |
| `webPush`          | `web-push`       |
| `mobilePush`       | `mobile-push`    |
| `sms`              | `sms`            |
| `whatsapp`         | `whatsapp`       |
| `randomWebPush`    | `web-push`       |
| `randomMobilePush` | `mobile-push`    |

### 3. Account channel availability

The React app already has `selectAccountChannels` in `app-store.ts` returning `AccountChannels { email, sms, webPush, mobilePush, whatsapp }`. The sidebar reads this to disable unavailable channels.

### 4. Reuse, don't duplicate

Since all channels share the same settings shape, we don't need 5 separate node components or 5 config panels. Instead:

- **One generic `MessageNode`** component that takes channel-specific props (color, icon, label)
- **One shared `MessageConfig`** (the existing `EmailConfig` renamed) that accepts a `messageType` param for the API query
- **One shared `RandomMessageConfig`** that accepts a `messageType` param
- The existing `email-node.tsx` and `random-message-node.tsx` become thin wrappers or are replaced by the generic

## Implementation Tasks

### Task 1: Update types

**File:** `editor/types.ts`

Add new step types to the union:

```typescript
export type AutomationStepType =
  | 'trigger'
  | 'wait'
  | 'email'
  | 'webPush'
  | 'mobilePush'
  | 'sms'
  | 'whatsapp'
  | 'testAB'
  | 'randomMessage'
  | 'randomWebPush'
  | 'randomMobilePush'
  | 'end';
```

All message channels reuse `EmailSettings` (same shape). Add step variants to the discriminated union.

Add a `MESSAGE_TYPE_MAP` constant:

```typescript
export const MESSAGE_TYPE_MAP: Record<string, string> = {
  email: 'email',
  webPush: 'web-push',
  mobilePush: 'mobile-push',
  sms: 'sms',
  whatsapp: 'whatsapp',
  randomMessage: 'email',
  randomWebPush: 'web-push',
  randomMobilePush: 'mobile-push',
};
```

### Task 2: Create generic message node component

**File:** `editor/nodes/message-node.tsx`

A configurable node component factory:

```typescript
export function createMessageNode(config: {
  channelKey: string
  icon: LucideIcon
  borderColor: string
  iconBgColor: string
  iconColor: string
}) { ... }
```

Each channel gets a thin export:

```typescript
export const EmailNode = createMessageNode({ channelKey: 'email', icon: Mail, borderColor: 'border-green-300', ... })
export const WebPushNode = createMessageNode({ channelKey: 'webPush', icon: Bell, borderColor: 'border-indigo-300', ... })
export const SmsNode = createMessageNode({ channelKey: 'sms', icon: MessageSquare, borderColor: 'border-cyan-300', ... })
export const MobilePushNode = createMessageNode({ channelKey: 'mobilePush', icon: Smartphone, borderColor: 'border-pink-300', ... })
export const WhatsappNode = createMessageNode({ channelKey: 'whatsapp', icon: Phone, borderColor: 'border-emerald-300', ... })
```

Delete the current `email-node.tsx` — replaced by the generic.

### Task 3: Create generic random message node

**File:** `editor/nodes/random-message-node.tsx`

Update to accept a `channelKey` prop via the same factory pattern. Create:

- `RandomMessageNode` (email)
- `RandomWebPushNode`
- `RandomMobilePushNode`

### Task 4: Update nodeTypes registry

**File:** `editor/nodes/index.ts`

Register all new node types.

### Task 5: Update config panels to accept messageType

**File:** `editor/panels/step-config-panel.tsx`

- Rename `useEmailMessages` → `useChannelMessages(messageType, search)` — passes the correct API `type` param
- The message config (single and random) receives `messageType` from `MESSAGE_TYPE_MAP[nodeType]`
- Add switch cases for all new step types

### Task 6: Update sidebar with channel blocks + disabled state

**File:** `editor/panels/blocks-sidebar.tsx`

- Read `selectAccountChannels` from the app store
- Each block item gets a `channelFlag` property
- If the account doesn't have the channel, render the block with `opacity-50 cursor-not-allowed` and `draggable={false}`
- Group layout:

```
Actions
  ⊞ Email
  ⊞ Web Push        (disabled if !webPush)
  ⊞ Mobile Push     (disabled if !mobilePush)
  ⊞ SMS             (disabled if !sms)
  ⊞ WhatsApp        (disabled if !whatsapp)
  ⊞ A/B Test        (email only)
  ⊞ Multiple Emails
  ⊞ Multiple Web Push    (disabled if !webPush)
  ⊞ Multiple Mobile Push (disabled if !mobilePush)
```

### Task 7: Update editor default settings

**File:** `editor/automation-editor.tsx`

Add default settings for all new step types (all share the same shape).

### Task 8: Add i18n keys

New keys for each channel in both `pt-BR.json` and `en-US.json`.

### Task 9: Type-check + tests

Verify all passes. Update serializer tests to include new step types in KNOWN_STEP_TYPES.

## Acceptance Criteria

- [ ] All 5 single-message channels work (email, webPush, mobilePush, sms, whatsapp)
- [ ] randomWebPush and randomMobilePush work
- [ ] testAB remains email-only
- [ ] Disabled channels show grayed out in sidebar (not draggable)
- [ ] Message search uses correct API type param per channel
- [ ] Settings shape matches API schema for all channels
- [ ] TypeScript type-check passes
- [ ] Existing tests pass
- [ ] i18n in pt-BR and en-US

## Sources

- Vue2 AddStepModal: `apps/frontend-vue2/src/modules/automations/components/AddStepModal.vue`
- Vue2 UpdateStepModal: `apps/frontend-vue2/src/modules/automations/components/UpdateStepModal.vue`
- API schema: `apps/msgops-api/src/modules/automations/schema/automation-schema.json`
- React account channels: `apps/frontend-react/src/stores/app-store.ts` → `selectAccountChannels`
